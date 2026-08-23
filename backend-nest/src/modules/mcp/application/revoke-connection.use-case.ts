import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  MCP_CONNECTION_REPOSITORY,
  type McpConnectionRepositoryPort,
} from '../domain/ports/mcp-connection-repository.port';
import {
  OAUTH_AUTHORIZATION_PORT,
  type OAuthAuthorizationPort,
} from '../domain/ports/oauth-authorization.port';
import type { RevokeAgentConnectionsPort } from '../domain/ports/revoke-agent-connections.port';

/**
 * The row dies first: once `revoked_at` is set and the wrapped key gone, the
 * guard refuses the agent's next call whatever the authorization server
 * still holds. Dropping the grant then stops token refresh; a failure there
 * is logged, not surfaced, because the access is already cut.
 */
@Injectable()
export class RevokeConnectionUseCase implements RevokeAgentConnectionsPort {
  constructor(
    @Inject(MCP_CONNECTION_REPOSITORY)
    private readonly connections: McpConnectionRepositoryPort,
    @Inject(OAUTH_AUTHORIZATION_PORT)
    private readonly authorizations: OAuthAuthorizationPort,
    @InjectInfoLogger(RevokeConnectionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    connectionId: string,
    accessToken: string,
  ): Promise<void> {
    const clientIds = await this.connections.revoke(userId, connectionId);
    if (clientIds.length === 0) {
      throw new BusinessException(ERROR_DEFINITIONS.MCP_CONNECTION_NOT_FOUND);
    }
    await this.#dropGrants(userId, clientIds, accessToken);
  }

  async revokeAll(userId: string, accessToken: string): Promise<void> {
    const clientIds = await this.connections.revoke(userId);
    await this.#dropGrants(userId, clientIds, accessToken);
  }

  async #dropGrants(
    userId: string,
    clientIds: string[],
    accessToken: string,
  ): Promise<void> {
    for (const clientId of clientIds) {
      try {
        await this.authorizations.revokeGrant(clientId, accessToken);
      } catch {
        this.logger.warn(
          { userId, operation: 'mcpConnection.revokeGrant' },
          'Connection revoked locally but the OAuth grant is still held',
        );
      }
    }
    if (clientIds.length > 0) {
      this.logger.info(
        { userId, operation: 'mcpConnection.revoke', count: clientIds.length },
        'Agent connections revoked',
      );
    }
  }
}
