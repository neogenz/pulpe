import { Inject, Injectable } from '@nestjs/common';
import {
  MCP_CONNECTION_REPOSITORY,
  type McpConnectionRepositoryPort,
  type McpConnectionSummary,
} from '../domain/ports/mcp-connection-repository.port';

@Injectable()
export class ListConnectionsUseCase {
  constructor(
    @Inject(MCP_CONNECTION_REPOSITORY)
    private readonly connections: McpConnectionRepositoryPort,
  ) {}

  execute(userId: string): Promise<McpConnectionSummary[]> {
    return this.connections.listActive(userId);
  }
}
