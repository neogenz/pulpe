import {
  All,
  Body,
  Controller,
  Req,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClsService } from 'nestjs-cls';
import {
  McpServer,
  type ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsUseCase } from '../../application/list-tools.use-case';
import { CallToolUseCase } from '../../application/call-tool.use-case';
import type { McpTool } from '../../domain/mcp-tool.entity';
import type { ActiveMcpConnection } from '../../domain/ports/mcp-connection-repository.port';
import { McpTokenGuard, type McpRequest } from '../auth/mcp-token.guard';

/**
 * Streamable HTTP endpoint, stateless: one `McpServer` per request, no
 * session id. The guard already put `user`, `supabase` and `clientKey` in
 * CLS, so the tools call Pulpe use cases in process.
 */
@ApiExcludeController()
@Controller({ path: 'mcp', version: VERSION_NEUTRAL })
@UseGuards(McpTokenGuard)
export class McpController {
  constructor(
    private readonly listTools: ListToolsUseCase,
    private readonly callTool: CallToolUseCase,
    private readonly cls: ClsService,
  ) {}

  @All()
  async handle(
    @Req() request: McpRequest,
    @Res() response: Response,
    @Body() body: unknown,
  ): Promise<void> {
    const connection = request.mcpConnection!;
    const server = this.#buildServer(connection, request.user!.id);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    // Same CLS contract as an `api/*` request, opened here because the CLS
    // middleware is mounted under the global prefix only.
    await this.cls.runWith(
      { user: request.user, supabase: request.supabase } as never,
      () => transport.handleRequest(request, response, body),
    );
  }

  #buildServer(connection: ActiveMcpConnection, userId: string): McpServer {
    const server = new McpServer({ name: 'pulpe', version: '1' });
    for (const tool of this.listTools.execute(connection.mode)) {
      this.#register(server, connection, userId, tool);
    }
    return server;
  }

  #register(
    server: McpServer,
    connection: ActiveMcpConnection,
    userId: string,
    tool: McpTool,
  ): void {
    const callback: ToolCallback<ZodRawShapeCompat> = async (args) => {
      try {
        const { text } = await this.callTool.execute(
          connection,
          userId,
          tool.name,
          args,
        );
        return { content: [{ type: 'text', text }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: describe(error) }],
        };
      }
    };
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema as ZodRawShapeCompat,
        annotations: tool.annotations,
      },
      callback,
    );
  }
}

/** Business messages are safe for the model; anything else stays generic. */
function describe(error: unknown): string {
  const status = (error as { getStatus?: () => number })?.getStatus?.();
  if (status && status < 500 && error instanceof Error) return error.message;
  return 'Pulpe n’a pas pu traiter cette demande.';
}
