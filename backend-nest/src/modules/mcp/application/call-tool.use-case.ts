import { Injectable } from '@nestjs/common';
import type { AccessMode } from '../domain/access-mode';
import type { McpToolResult } from '../domain/mcp-tool.entity';
import { ListToolsUseCase } from './list-tools.use-case';

export class McpToolNotAvailableError extends Error {
  constructor(name: string) {
    super(`Tool "${name}" is not available for this connection`);
  }
}

@Injectable()
export class CallToolUseCase {
  constructor(private readonly listTools: ListToolsUseCase) {}

  /** Dispatch against the mode-filtered catalog: a direct call to a hidden tool is refused. */
  async execute(
    mode: AccessMode,
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const tool = this.listTools.execute(mode).find((t) => t.name === name);
    if (!tool) throw new McpToolNotAvailableError(name);
    return tool.execute(args);
  }
}
