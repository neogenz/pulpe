import type { NewMcpConnection } from '../mcp-connection.entity';

export const OAUTH_AUTHORIZATION_PORT = Symbol('OAUTH_AUTHORIZATION_PORT');

/** A pending OAuth 2.1 authorization request held by the authorization server. */
export interface OAuthAuthorizationRequest {
  readonly clientId: string;
  readonly clientName: string;
}

/**
 * The consent side of the authorization server, acted on as the signed-in
 * user. approve/deny answer with the URL the browser must be sent back to
 * (it carries the code or the OAuth error).
 */
export interface OAuthAuthorizationPort {
  getDetails(
    authorizationId: string,
    accessToken: string,
  ): Promise<OAuthAuthorizationRequest>;
  approve(
    authorizationId: string,
    accessToken: string,
    connection: NewMcpConnection,
  ): Promise<string>;
  deny(authorizationId: string, accessToken: string): Promise<string>;
  /** Retires legacy native grants; opaque grants are revoked in the connection store. */
  revokeGrant(clientId: string, accessToken: string): Promise<void>;
}
