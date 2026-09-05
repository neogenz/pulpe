import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Response } from 'express';
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import {
  OAuthClientMetadataSchema,
  type OAuthClientInformationFull,
  type OAuthTokenRevocationRequest,
  type OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidScopeError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  SupabaseMcpOAuthRepository,
  hashMcpCredential,
  type McpOAuthGrant,
} from '../persistence/supabase-mcp-oauth.repository';
import {
  SupabaseOAuthAuthorizationAdapter,
  type PrivateMcpSession,
} from './supabase-oauth-authorization.adapter';

const SCOPES = ['mcp'];
const registrationSchema = OAuthClientMetadataSchema.extend({
  redirect_uris: z.array(z.string().refine(isMcpRedirectUri)).min(1),
  token_endpoint_auth_method: z
    .enum(['none', 'client_secret_post'])
    .default('client_secret_post'),
  grant_types: z
    .array(z.enum(['authorization_code', 'refresh_token']))
    .default(['authorization_code', 'refresh_token'])
    .refine((grants) => grants.includes('authorization_code')),
  response_types: z.tuple([z.literal('code')]).optional(),
  client_name: z.string().max(200).optional(),
  scope: z.literal('mcp').optional(),
});
const credential = (kind: 'at' | 'rt'): string =>
  `mcp_${kind}_${randomBytes(32).toString('base64url')}`;

/** The SDK owns OAuth parsing/PKCE. Only Pulpe opaque credentials cross this boundary. */
@Injectable()
export class McpOAuthProvider implements OAuthServerProvider {
  readonly resource: URL;

  constructor(
    private readonly store: SupabaseMcpOAuthRepository,
    private readonly upstream: SupabaseOAuthAuthorizationAdapter,
    private readonly config: ConfigService,
  ) {
    this.resource = new URL(config.getOrThrow<string>('MCP_RESOURCE_URL'));
  }

  get clientsStore() {
    return this;
  }

  get enabled(): boolean {
    return !!this.config.get<string>('MCP_UPSTREAM_CLIENT_ID');
  }

  getClient(id: string): Promise<OAuthClientInformationFull | undefined> {
    return id.startsWith('pulpe_')
      ? this.store.getClient(id)
      : Promise.resolve(undefined);
  }

  async registerClient(
    input: Omit<
      OAuthClientInformationFull,
      'client_id' | 'client_id_issued_at'
    >,
  ): Promise<OAuthClientInformationFull> {
    const metadata = registrationSchema.safeParse(input);
    if (
      !metadata.success ||
      (metadata.data.token_endpoint_auth_method !== 'none' &&
        !input.client_secret)
    ) {
      throw new InvalidClientMetadataError('Unsupported client metadata');
    }
    const method = metadata.data.token_endpoint_auth_method;
    const client: OAuthClientInformationFull = {
      ...input,
      ...metadata.data,
      client_id: `pulpe_${randomUUID()}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: input.client_name?.trim() || 'MCP client',
      token_endpoint_auth_method: method,
      response_types: ['code'],
      scope: SCOPES.join(' '),
      client_secret: method === 'none' ? undefined : input.client_secret,
      client_secret_expires_at: method === 'none' ? undefined : 0,
    };
    await this.store.saveClient(client);
    return client;
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    this.#resource(params.resource);
    this.#scopes(params.scopes);
    if (
      !isMcpRedirectUri(params.redirectUri) ||
      !/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge) ||
      (params.state?.length ?? 0) > 2048
    ) {
      throw new InvalidRequestError('Invalid authorization parameters');
    }
    const id = await this.store.createAuthorization(
      client.client_id,
      params,
      this.resource.href,
    );
    const consent = new URL(this.config.getOrThrow<string>('MCP_CONSENT_URL'));
    consent.searchParams.set('authorization_id', id);
    res.redirect(consent.href);
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
  ): Promise<string> {
    return (await this.#code(client.client_id, code)).authorization.challenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
    _verifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    this.#resource(resource);
    const { authorization, grant } = await this.#code(client.client_id, code);
    const redirect =
      redirectUri ??
      (client.redirect_uris.length === 1 ? client.redirect_uris[0] : undefined);
    if (redirect !== authorization.redirect_uri)
      throw new InvalidGrantError('Invalid authorization grant');
    const pair = this.#pair(this.store.readSession(grant), grant);
    const consumed = await this.store.exchangeCode(
      hashMcpCredential(code),
      client.client_id,
      authorization.redirect_uri,
      this.resource.href,
      pair.stored,
    );
    if (!consumed) throw new InvalidGrantError('Invalid authorization grant');
    return this.#tokens(pair, client);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    token: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    this.#resource(resource);
    this.#scopes(scopes);
    if (
      !/^mcp_rt_[A-Za-z0-9_-]{43}$/.test(token) ||
      !client.grant_types?.includes('refresh_token')
    ) {
      throw new InvalidGrantError('Invalid refresh grant');
    }
    const claim = await this.store.claimRefresh(
      hashMcpCredential(token),
      client.client_id,
    );
    if (!claim) throw new InvalidGrantError('Invalid refresh grant');
    let session: PrivateMcpSession;
    try {
      session = await this.upstream.refreshPrivateSession(
        this.store.readSession(claim.connection).refreshToken,
        claim.connection.user_id,
      );
    } catch (error) {
      // No external pair has been issued. A failed upstream attempt is not a replay.
      await this.store.releaseRefresh(claim.token_id);
      throw error;
    }
    const pair = this.#pair(session, claim.connection);
    const replaced = await this.store.finishRefresh(
      claim.token_id,
      claim.connection,
      session,
      pair.stored,
    );
    if (!replaced) throw new InvalidGrantError('Invalid refresh grant');
    return this.#tokens(pair, client);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!this.enabled) throw new InvalidTokenError('MCP is not configured');
    if (!/^mcp_at_[A-Za-z0-9_-]{43}$/.test(token))
      throw new InvalidTokenError('Invalid MCP token');
    const active = await this.store.forAccess(hashMcpCredential(token));
    if (!active) throw new InvalidTokenError('Invalid MCP token');
    const session = this.store.readSession(active.grant);
    if (session.expiresAt <= Date.now() / 1000)
      throw new InvalidTokenError('Invalid MCP token');
    return {
      token,
      clientId: active.grant.client_id,
      scopes: SCOPES,
      resource: this.resource,
      expiresAt: active.expiresAt,
      extra: {
        userId: active.grant.user_id,
        generation: active.grant.generation,
        upstreamAccessToken: session.accessToken,
      },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    if (!/^mcp_(at|rt)_[A-Za-z0-9_-]{43}$/.test(request.token)) return;
    await this.store.revokeToken(
      hashMcpCredential(request.token),
      client.client_id,
    );
  }

  async #code(clientId: string, code: string) {
    if (!/^mcp_ac_[A-Za-z0-9_-]{43}$/.test(code))
      throw new InvalidGrantError('Invalid authorization grant');
    const result = await this.store.forCode(hashMcpCredential(code), clientId);
    if (!result) throw new InvalidGrantError('Invalid authorization grant');
    return result;
  }

  #pair(session: PrivateMcpSession, grant: McpOAuthGrant) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = Math.floor(
      Math.min(
        now + 3600,
        session.expiresAt - 30,
        Date.parse(grant.grant_expires_at) / 1000,
      ),
    );
    if (expiresAt <= now)
      throw new InvalidGrantError('Expired authorization grant');
    const access = credential('at');
    const refresh = credential('rt');
    return {
      access,
      refresh,
      expiresIn: expiresAt - now,
      stored: {
        accessHash: hashMcpCredential(access),
        refreshHash: hashMcpCredential(refresh),
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      },
    };
  }

  #tokens(
    pair: { access: string; refresh: string; expiresIn: number },
    client: OAuthClientInformationFull,
  ): OAuthTokens {
    return {
      access_token: pair.access,
      token_type: 'Bearer',
      expires_in: pair.expiresIn,
      refresh_token: client.grant_types?.includes('refresh_token')
        ? pair.refresh
        : undefined,
      scope: SCOPES.join(' '),
    };
  }

  #resource(resource?: URL): void {
    if (resource && resource.href !== this.resource.href)
      throw new InvalidRequestError('Invalid resource');
  }

  #scopes(scopes?: string[]): void {
    if (scopes?.some((scope) => !SCOPES.includes(scope)))
      throw new InvalidScopeError('Unsupported scope');
  }
}

export function isMcpRedirectUri(value: string): boolean {
  try {
    const uri = new URL(value);
    return (
      !uri.username &&
      !uri.password &&
      !uri.hash &&
      (uri.protocol === 'https:' ||
        (uri.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname)))
    );
  } catch {
    return false;
  }
}
