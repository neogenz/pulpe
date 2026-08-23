import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAccessMode } from '../../domain/access-mode';
import type {
  ActiveMcpConnection,
  McpConnectionRepositoryPort,
} from '../../domain/ports/mcp-connection-repository.port';

/**
 * ponytail: phase-1 stand-in until `mcp_connection` exists (phase 2).
 * One connection for every (user, client) pair, fed by `MCP_TEST_CLIENT_KEY`
 * and `MCP_TEST_ACCESS_MODE`. Unset → no connection → 401. Never a default key.
 */
@Injectable()
export class EnvMcpConnectionRepository implements McpConnectionRepositoryPort {
  constructor(private readonly config: ConfigService) {}

  async findActive(
    _userId: string,
    clientId: string,
  ): Promise<ActiveMcpConnection | null> {
    const hex = this.config.get<string>('MCP_TEST_CLIENT_KEY');
    const mode = this.config.get<string>('MCP_TEST_ACCESS_MODE');
    if (!hex || !isAccessMode(mode)) return null;

    const clientKey = Buffer.from(hex, 'hex');
    if (clientKey.length !== 32 || clientKey.every((b) => b === 0)) {
      return null;
    }
    return { clientId, mode, clientKey };
  }
}
