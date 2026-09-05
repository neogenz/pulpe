import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type {
  OAuthAuthorizationPort,
  OAuthAuthorizationRequest,
} from '../../domain/ports/oauth-authorization.port';

const detailsSchema = z.object({
  client: z.object({ id: z.string(), name: z.string() }),
});
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
 * GoTrue's OAuth 2.1 consent API (supabase-js 2.56 has no binding for it):
 * `GET  /auth/v1/oauth/authorizations/{id}` and
 * `POST /auth/v1/oauth/authorizations/{id}/consent {action}`,
 * both as the signed-in user. A consumed or unknown id answers 400 → 422 here.
 */
@Injectable()
export class SupabaseOAuthAuthorizationAdapter implements OAuthAuthorizationPort {
  readonly #authUrl: string;
  readonly #baseUrl: string;
  readonly #anonKey: string;

  constructor(private readonly config: ConfigService) {
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
    accessToken: string,
  ): Promise<OAuthAuthorizationRequest> {
    const { client } = detailsSchema.parse(
      await this.#call(authorizationId, accessToken),
    );
    return { clientId: client.id, clientName: client.name };
  }

  approve(authorizationId: string, accessToken: string): Promise<string> {
    return this.#decide(authorizationId, accessToken, 'approve');
  }

  deny(authorizationId: string, accessToken: string): Promise<string> {
    return this.#decide(authorizationId, accessToken, 'deny');
  }

  /** `DELETE /auth/v1/user/oauth/grants?client_id=` answers 204; a grant already gone is not an error. */
  async revokeGrant(clientId: string, accessToken: string): Promise<void> {
    const url = `${this.#authUrl}/user/oauth/grants?client_id=${encodeURIComponent(clientId)}`;
    const response = await fetch(url, {
      method: 'DELETE',
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
