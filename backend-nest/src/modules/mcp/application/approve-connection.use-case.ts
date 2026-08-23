import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AccessMode } from '../domain/access-mode';
import {
  MCP_CONNECTION_REPOSITORY,
  type McpConnectionRepositoryPort,
} from '../domain/ports/mcp-connection-repository.port';
import {
  OAUTH_AUTHORIZATION_PORT,
  type OAuthAuthorizationPort,
} from '../domain/ports/oauth-authorization.port';

export interface ApproveConnectionInput {
  readonly authorizationId: string;
  readonly mode: AccessMode;
  readonly user: {
    readonly id: string;
    readonly accessToken: string;
    /** Already proven against the vault by `AuthGuard`. */
    readonly clientKey: Buffer;
  };
}

/**
 * Records the grant before telling the authorization server: if the row
 * cannot be written, the client never receives a code.
 */
@Injectable()
export class ApproveConnectionUseCase {
  constructor(
    @Inject(OAUTH_AUTHORIZATION_PORT)
    private readonly authorizations: OAuthAuthorizationPort,
    @Inject(MCP_CONNECTION_REPOSITORY)
    private readonly connections: McpConnectionRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  /** @returns the URL the browser must be sent back to (carries the code). */
  async execute({
    authorizationId,
    mode,
    user,
  }: ApproveConnectionInput): Promise<string> {
    const { clientId, clientName } = await this.authorizations.getDetails(
      authorizationId,
      user.accessToken,
    );
    await this.connections.save({
      userId: user.id,
      clientId,
      clientName,
      mode,
      wrappedClientKey: this.encryption.wrapSecret(user.clientKey),
    });
    return this.authorizations.approve(authorizationId, user.accessToken);
  }
}
