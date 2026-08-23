import { Inject, Injectable } from '@nestjs/common';
import type { McpToolResult } from '../domain/mcp-tool.entity';
import type { ActiveMcpConnection } from '../domain/ports/mcp-connection-repository.port';
import {
  MCP_ACTIVITY_REPOSITORY,
  type McpActivityRepositoryPort,
} from '../domain/ports/mcp-activity-repository.port';
import { ListToolsUseCase } from './list-tools.use-case';

export class McpToolNotAvailableError extends Error {
  constructor(name: string) {
    super(`Tool "${name}" is not available for this connection`);
  }
}

@Injectable()
export class CallToolUseCase {
  constructor(
    private readonly listTools: ListToolsUseCase,
    @Inject(MCP_ACTIVITY_REPOSITORY)
    private readonly activity: McpActivityRepositoryPort,
  ) {}

  /**
   * Dispatch against the mode-filtered catalog: a direct call to a hidden
   * tool is refused. Every write tool call lands in the activity log, with
   * its outcome and nothing of its arguments.
   */
  async execute(
    connection: ActiveMcpConnection,
    userId: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const tool = this.listTools
      .execute(connection.mode)
      .find((t) => t.name === name);
    if (!tool) throw new McpToolNotAvailableError(name);
    if (tool.mode !== 'read_write') return tool.execute(args);
    try {
      const result = await tool.execute(args);
      await this.#record(connection, userId, name, 'ok');
      return result;
    } catch (error) {
      await this.#record(connection, userId, name, 'error');
      throw error;
    }
  }

  #record(
    connection: ActiveMcpConnection,
    userId: string,
    tool: string,
    outcome: 'ok' | 'error',
  ): Promise<void> {
    return this.activity.record({
      connectionId: connection.id,
      userId,
      tool,
      outcome,
    });
  }
}
