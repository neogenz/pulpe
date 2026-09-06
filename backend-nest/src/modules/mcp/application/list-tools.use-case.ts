import { Inject, Injectable } from '@nestjs/common';
import { type AccessMode, allowsTool } from '../domain/access-mode';
import type { McpTool } from '../domain/mcp-tool.entity';
import { MCP_TOOLS } from '../mcp.tokens';

@Injectable()
export class ListToolsUseCase {
  constructor(@Inject(MCP_TOOLS) private readonly tools: McpTool[]) {}

  execute(mode: AccessMode): McpTool[] {
    return this.tools.filter((tool) => allowsTool(mode, tool.mode));
  }
}
