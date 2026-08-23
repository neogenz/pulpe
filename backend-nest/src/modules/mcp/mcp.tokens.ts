export { MCP_CONNECTION_REPOSITORY } from './domain/ports/mcp-connection-repository.port';
export type {
  ActiveMcpConnection,
  McpConnectionRepositoryPort,
} from './domain/ports/mcp-connection-repository.port';

/** Array token: every registered `McpTool`. */
export const MCP_TOOLS = Symbol('MCP_TOOLS');
