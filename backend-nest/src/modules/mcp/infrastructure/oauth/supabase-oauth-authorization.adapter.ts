import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  SupabaseMcpOAuthRepository,
  hashMcpCredential,
} from '../persistence/supabase-mcp-oauth.repository';
import type { NewMcpConnection } from '../../domain/mcp-connection.entity';
import type {
  OAuthAuthorizationPort,
  OAuthAuthorizationRequest,
} from '../../domain/ports/oauth-authorization.port';

const decisionSchema = z.object({ redirect_url: z.url() });

type Action = 'approve' | 'deny';

const sessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export interface PrivateMcpSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

/**
 * Pulpe consent only accepts requests from its own issuer. GoTrue's native
 * code and session are exchanged privately after the user's consent and PIN.
 */
@Injectable()
export class SupabaseOAuthAuthorizationAdapter implements OAuthAuthorizationPort {
  readonly #authUrl: string;
  readonly #baseUrl: string;
  readonly #anonKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly store: SupabaseMcpOAuthRepository,
  ) {
    this.#authUrl = `${config.getOrThrow<string>('SUPABASE_URL')}/auth/v1`;
    this.#baseUrl = `${this.#authUrl}/oauth/authorizations`;
    this.#anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
  }

  /** Backend-to-backend only: neither this code nor these tokens reach the browser. */
  async createPrivateSession(
    accessToken: string,
    userId: string,
  ): Promise<PrivateMcpSession> {
    const verifier = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const callback = this.#privateCallback();
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('MCP_UPSTREAM_CLIENT_ID'),
      response_type: 'code',
      redirect_uri: callback,
      state,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    });
    const response = await fetch(`${this.#authUrl}/oauth/authorize?${params}`, {
      redirect: 'manual',
      headers: { apikey: this.#anonKey },
      signal: AbortSignal.timeout(10_000),
    });
    const location = response.headers.get('location');
    if (response.status !== 302 || !location) this.#fail('privateAuthorize');
    const id = new URL(location).searchParams.get('authorization_id');
    if (!id) this.#fail('privateAuthorizationId');
    // GoTrue can return a code immediately when this owner already consented.
    // Only ask it here, after Pulpe's own consent and vault-key checks.
    const details = await this.#call(id, accessToken);
    const existing = decisionSchema.safeParse(details);
    const redirect = new URL(
      existing.success
        ? existing.data.redirect_url
        : await this.#decide(id, accessToken, 'approve'),
    );
    if (
      `${redirect.origin}${redirect.pathname}` !== callback ||
      redirect.searchParams.get('state') !== state ||
      !redirect.searchParams.get('code') ||
      redirect.hash
    )
      this.#fail('privateCallback');
    return this.#exchangePrivate(
      {
        grant_type: 'authorization_code',
        code: redirect.searchParams.get('code')!,
        code_verifier: verifier,
        redirect_uri: callback,
      },
      userId,
    );
  }

  refreshPrivateSession(
    refreshToken: string,
    userId: string,
  ): Promise<PrivateMcpSession> {
    return this.#exchangePrivate(
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      userId,
    );
  }

  #privateCallback(): string {
    return new URL(
      '/mcp/oauth/upstream-callback',
      this.config.getOrThrow<string>('MCP_RESOURCE_URL'),
    ).href;
  }

  async #exchangePrivate(
    grant: Record<string, string>,
    userId: string,
  ): Promise<PrivateMcpSession> {
    const requestedAt = Math.floor(Date.now() / 1000);
    const response = await fetch(`${this.#authUrl}/oauth/token`, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        apikey: this.#anonKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ...grant,
        client_id: this.config.getOrThrow<string>('MCP_UPSTREAM_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>(
          'MCP_UPSTREAM_CLIENT_SECRET',
        ),
      }),
    });
    if (!response.ok) this.#fail('privateExchange');
    const session = sessionSchema.safeParse(await response.json());
    if (!session.success) this.#fail('privateSession');
    const owner = await fetch(`${this.#authUrl}/user`, {
      headers: this.#headers(session.data.access_token),
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (!owner.ok || (await owner.json()).id !== userId)
      this.#fail('privateOwner');
    return {
      accessToken: session.data.access_token,
      refreshToken: session.data.refresh_token,
      expiresAt: requestedAt + session.data.expires_in,
    };
  }

  #fail(operation: string): never {
    throw new BusinessException(
      ERROR_DEFINITIONS.MCP_AUTHORIZATION_UNPROCESSABLE,
      undefined,
      { operation },
    );
  }

  async getDetails(
    authorizationId: string,
    _accessToken: string,
  ): Promise<OAuthAuthorizationRequest> {
    const request = await this.store.pending(authorizationId);
    if (!request) this.#fail('getDetails');
    const client = await this.store.getClient(request.client_id);
    if (!client) this.#fail('getDetails');
    return {
      clientId: client.client_id,
      clientName: client.client_name ?? 'MCP client',
    };
  }

  async approve(
    authorizationId: string,
    accessToken: string,
    connection: NewMcpConnection,
  ): Promise<string> {
    const request = await this.store.decide(authorizationId, 'approving');
    if (!request || request.client_id !== connection.clientId)
      this.#fail('approve');
    const session = await this.createPrivateSession(
      accessToken,
      connection.userId,
    );
    const code = `mcp_ac_${randomBytes(32).toString('base64url')}`;
    if (
      !(await this.store.complete(
        authorizationId,
        connection,
        session,
        randomUUID(),
        hashMcpCredential(code),
      ))
    ) {
      this.#fail('approve');
    }
    return this.#callback(request, 'code', code);
  }

  async deny(authorizationId: string, _accessToken: string): Promise<string> {
    const request = await this.store.decide(authorizationId, 'denied');
    if (!request) this.#fail('deny');
    return this.#callback(request, 'error', 'access_denied');
  }

  #callback(
    request: { redirect_uri: string; state: string | null },
    field: 'code' | 'error',
    value: string,
  ): string {
    const callback = new URL(request.redirect_uri);
    for (const key of ['code', 'error', 'state'])
      callback.searchParams.delete(key);
    callback.searchParams.set(field, value);
    if (request.state !== null)
      callback.searchParams.set('state', request.state);
    return callback.href;
  }

  /** `DELETE /auth/v1/user/oauth/grants?client_id=` answers 204; a grant already gone is not an error. */
  async revokeGrant(clientId: string, accessToken: string): Promise<void> {
    // New grants destroy their private credentials locally. Revoking the
    // shared native client would disconnect this owner's other assistants.
    if (clientId.startsWith('pulpe_')) return;
    const url = `${this.#authUrl}/user/oauth/grants?client_id=${encodeURIComponent(clientId)}`;
    const response = await fetch(url, {
      method: 'DELETE',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: this.#headers(accessToken),
    });
    if (!response.ok && response.status !== 404) {
      throw new BusinessException(
        ERROR_DEFINITIONS.MCP_AUTHORIZATION_UNPROCESSABLE,
        undefined,
        { operation: 'revokeGrant', status: response.status },
      );
    }
  }

  async #decide(
    authorizationId: string,
    accessToken: string,
    action: Action,
  ): Promise<string> {
    const body = await this.#call(authorizationId, accessToken, action);
    return decisionSchema.parse(body).redirect_url;
  }

  async #call(
    authorizationId: string,
    accessToken: string,
    action?: Action,
  ): Promise<unknown> {
    const url = `${this.#baseUrl}/${encodeURIComponent(authorizationId)}${action ? '/consent' : ''}`;
    const response = await fetch(url, {
      method: action ? 'POST' : 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: this.#headers(accessToken),
      body: action ? JSON.stringify({ action }) : undefined,
    });
    if (!response.ok) {
      throw new BusinessException(
        ERROR_DEFINITIONS.MCP_AUTHORIZATION_UNPROCESSABLE,
        undefined,
        { operation: action ?? 'getDetails', status: response.status },
      );
    }
    return response.json();
  }

  #headers(accessToken: string): Record<string, string> {
    return {
      apikey: this.#anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }
}
