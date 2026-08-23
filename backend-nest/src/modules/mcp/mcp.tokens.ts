export { MCP_CONNECTION_REPOSITORY } from './domain/ports/mcp-connection-repository.port';
export type {
  ActiveMcpConnection,
  McpConnectionRepositoryPort,
} from './domain/ports/mcp-connection-repository.port';
export { OAUTH_AUTHORIZATION_PORT } from './domain/ports/oauth-authorization.port';
export type {
  OAuthAuthorizationPort,
  OAuthAuthorizationRequest,
} from './domain/ports/oauth-authorization.port';

/** Array token: every registered `McpTool`. */
export const MCP_TOOLS = Symbol('MCP_TOOLS');
