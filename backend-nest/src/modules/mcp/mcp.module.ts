import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetModule } from '@modules/budget/budget.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { ListToolsUseCase } from './application/list-tools.use-case';
import { CallToolUseCase } from './application/call-tool.use-case';
import { ApproveConnectionUseCase } from './application/approve-connection.use-case';
import { DenyConnectionUseCase } from './application/deny-connection.use-case';
import { ListActivityUseCase } from './application/list-activity.use-case';
import { ListConnectionsUseCase } from './application/list-connections.use-case';
import { McpTokenGuard } from './infrastructure/auth/mcp-token.guard';
import { McpController } from './infrastructure/http/mcp.controller';
import { McpConnectionsController } from './infrastructure/http/mcp-connections.controller';
import { McpConsentController } from './infrastructure/http/mcp-consent.controller';
import { ProtectedResourceMetadataController } from './infrastructure/http/protected-resource-metadata.controller';
import { SupabaseMcpActivityRepository } from './infrastructure/persistence/supabase-mcp-activity.repository';
import { McpActivityPurgeCron } from './infrastructure/scheduler/mcp-activity-purge.cron';
import { GetCurrentMonthTool } from './infrastructure/tools/get-current-month.tool';
import { AddMovementTool } from './infrastructure/tools/add-movement.tool';
import { McpRevocationModule } from './mcp-revocation.module';
import { MCP_ACTIVITY_REPOSITORY, MCP_TOOLS } from './mcp.tokens';

const TOOLS = [GetCurrentMonthTool, AddMovementTool];

@Module({
  imports: [McpRevocationModule, BudgetModule, TransactionModule],
  controllers: [
    McpController,
    McpConsentController,
    McpConnectionsController,
    ProtectedResourceMetadataController,
  ],
  providers: [
    ListToolsUseCase,
    CallToolUseCase,
    ApproveConnectionUseCase,
    DenyConnectionUseCase,
    ListConnectionsUseCase,
    ListActivityUseCase,
    McpTokenGuard,
    SupabaseMcpActivityRepository,
    {
      provide: MCP_ACTIVITY_REPOSITORY,
      useExisting: SupabaseMcpActivityRepository,
    },
    McpActivityPurgeCron,
    ...TOOLS,
    {
      provide: MCP_TOOLS,
      useFactory: (...tools: unknown[]) => tools,
      inject: TOOLS,
    },
    createInfoLoggerProvider(McpTokenGuard.name),
    createInfoLoggerProvider(SupabaseMcpActivityRepository.name),
  ],
})
export class McpModule {}
