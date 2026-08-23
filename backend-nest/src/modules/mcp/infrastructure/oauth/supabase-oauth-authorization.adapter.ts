import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(config: ConfigService) {
    this.#authUrl = `${config.getOrThrow<string>('SUPABASE_URL')}/auth/v1`;
    this.#baseUrl = `${this.#authUrl}/oauth/authorizations`;
    this.#anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
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
