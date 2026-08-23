import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetModule } from '@modules/budget/budget.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { ListToolsUseCase } from './application/list-tools.use-case';
import { CallToolUseCase } from './application/call-tool.use-case';
import { McpTokenGuard } from './infrastructure/auth/mcp-token.guard';
import { McpController } from './infrastructure/http/mcp.controller';
import { McpConsentController } from './infrastructure/http/mcp-consent.controller';
import { ProtectedResourceMetadataController } from './infrastructure/http/protected-resource-metadata.controller';
import { SupabaseMcpConnectionRepository } from './infrastructure/persistence/supabase-mcp-connection.repository';
import { SupabaseOAuthAuthorizationAdapter } from './infrastructure/oauth/supabase-oauth-authorization.adapter';
import { ApproveConnectionUseCase } from './application/approve-connection.use-case';
import { DenyConnectionUseCase } from './application/deny-connection.use-case';
import { GetCurrentMonthTool } from './infrastructure/tools/get-current-month.tool';
import { AddMovementTool } from './infrastructure/tools/add-movement.tool';
import {
  MCP_CONNECTION_REPOSITORY,
  MCP_TOOLS,
  OAUTH_AUTHORIZATION_PORT,
} from './mcp.tokens';

const TOOLS = [GetCurrentMonthTool, AddMovementTool];

@Module({
  imports: [EncryptionModule, BudgetModule, TransactionModule],
  controllers: [
    McpController,
    McpConsentController,
    ProtectedResourceMetadataController,
  ],
  providers: [
    ListToolsUseCase,
    CallToolUseCase,
    ApproveConnectionUseCase,
    DenyConnectionUseCase,
    McpTokenGuard,
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
    ...TOOLS,
    {
      provide: MCP_TOOLS,
      useFactory: (...tools: unknown[]) => tools,
      inject: TOOLS,
    },
    createInfoLoggerProvider(McpTokenGuard.name),
  ],
})
export class McpModule {}
