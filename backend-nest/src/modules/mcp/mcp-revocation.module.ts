import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { RevokeConnectionUseCase } from './application/revoke-connection.use-case';
import { SupabaseMcpConnectionRepository } from './infrastructure/persistence/supabase-mcp-connection.repository';
import { SupabaseOAuthAuthorizationAdapter } from './infrastructure/oauth/supabase-oauth-authorization.adapter';
import { SupabaseMcpOAuthRepository } from './infrastructure/persistence/supabase-mcp-oauth.repository';
import { McpOAuthProvider } from './infrastructure/oauth/mcp-oauth.provider';
import {
  MCP_CONNECTION_REPOSITORY,
  OAUTH_AUTHORIZATION_PORT,
  REVOKE_AGENT_CONNECTIONS_PORT,
} from './mcp.tokens';

/**
 * The slice of the MCP module that other modules may depend on. Encryption
 * (PIN change, recovery) and user (account deletion) import this one, not
 * `McpModule`, which would pull the tool catalog and a cycle with them.
 */
@Module({
  providers: [
    SupabaseMcpOAuthRepository,
    McpOAuthProvider,
    SupabaseMcpConnectionRepository,
    {
      provide: MCP_CONNECTION_REPOSITORY,
      useExisting: SupabaseMcpConnectionRepository,
    },
    SupabaseOAuthAuthorizationAdapter,
    {
      provide: OAUTH_AUTHORIZATION_PORT,
      useExisting: SupabaseOAuthAuthorizationAdapter,
    },
    RevokeConnectionUseCase,
    {
      provide: REVOKE_AGENT_CONNECTIONS_PORT,
      useExisting: RevokeConnectionUseCase,
    },
    createInfoLoggerProvider(RevokeConnectionUseCase.name),
  ],
  exports: [
    SupabaseMcpOAuthRepository,
    McpOAuthProvider,
    MCP_CONNECTION_REPOSITORY,
    OAUTH_AUTHORIZATION_PORT,
    REVOKE_AGENT_CONNECTIONS_PORT,
    RevokeConnectionUseCase,
  ],
})
export class McpRevocationModule {}
