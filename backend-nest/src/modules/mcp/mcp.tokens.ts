export { MCP_CONNECTION_REPOSITORY } from './domain/ports/mcp-connection-repository.port';
export type {
  ActiveMcpConnection,
  McpConnectionRepositoryPort,
  McpConnectionSummary,
} from './domain/ports/mcp-connection-repository.port';
export { MCP_ACTIVITY_REPOSITORY } from './domain/ports/mcp-activity-repository.port';
export type { McpActivityRepositoryPort } from './domain/ports/mcp-activity-repository.port';
export { REVOKE_AGENT_CONNECTIONS_PORT } from './domain/ports/revoke-agent-connections.port';
export type { RevokeAgentConnectionsPort } from './domain/ports/revoke-agent-connections.port';
export { OAUTH_AUTHORIZATION_PORT } from './domain/ports/oauth-authorization.port';
export type {
  OAuthAuthorizationPort,
  OAuthAuthorizationRequest,
} from './domain/ports/oauth-authorization.port';

/** Array token: every registered `McpTool`. */
export const MCP_TOOLS = Symbol('MCP_TOOLS');
