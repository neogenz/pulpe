import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetModule } from '@modules/budget/budget.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { ListToolsUseCase } from './application/list-tools.use-case';
import { CallToolUseCase } from './application/call-tool.use-case';
import { McpTokenGuard } from './infrastructure/auth/mcp-token.guard';
import { McpController } from './infrastructure/http/mcp.controller';
import { ProtectedResourceMetadataController } from './infrastructure/http/protected-resource-metadata.controller';
import { EnvMcpConnectionRepository } from './infrastructure/persistence/env-mcp-connection.repository';
import { GetCurrentMonthTool } from './infrastructure/tools/get-current-month.tool';
import { AddMovementTool } from './infrastructure/tools/add-movement.tool';
import { MCP_CONNECTION_REPOSITORY, MCP_TOOLS } from './mcp.tokens';

const TOOLS = [GetCurrentMonthTool, AddMovementTool];

@Module({
  imports: [EncryptionModule, BudgetModule, TransactionModule],
  controllers: [McpController, ProtectedResourceMetadataController],
  providers: [
    ListToolsUseCase,
    CallToolUseCase,
    McpTokenGuard,
    EnvMcpConnectionRepository,
    {
      provide: MCP_CONNECTION_REPOSITORY,
      useExisting: EnvMcpConnectionRepository,
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
