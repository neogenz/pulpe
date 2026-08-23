import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { UserModule } from '@modules/user/user.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { SavingsGoalModule } from '@modules/savings-goal/savings-goal.module';
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
import { GetCurrentMonthTool } from './infrastructure/tools/read/get-current-month.tool';
import { GetMonthTool } from './infrastructure/tools/read/get-month.tool';
import { ListMonthsTool } from './infrastructure/tools/read/list-months.tool';
import { SearchMovementsTool } from './infrastructure/tools/read/search-movements.tool';
import { ListSavingsGoalsTool } from './infrastructure/tools/read/list-savings-goals.tool';
import { GetSavingsGoalOutlookTool } from './infrastructure/tools/read/get-savings-goal-outlook.tool';
import { ListTemplatesTool } from './infrastructure/tools/read/list-templates.tool';
import { AddMovementTool } from './infrastructure/tools/write/add-movement.tool';
import { UpdateMovementTool } from './infrastructure/tools/write/update-movement.tool';
import { DeleteMovementTool } from './infrastructure/tools/write/delete-movement.tool';
import { AddForecastTool } from './infrastructure/tools/write/add-forecast.tool';
import { UpdateForecastTool } from './infrastructure/tools/write/update-forecast.tool';
import { SpreadExpenseTool } from './infrastructure/tools/write/spread-expense.tool';
import { CreateMonthFromTemplateTool } from './infrastructure/tools/write/create-month-from-template.tool';
import { ToggleCheckTool } from './infrastructure/tools/write/toggle-check.tool';
import { ResolveCurrencyUseCase } from './application/resolve-currency.use-case';
import { McpRevocationModule } from './mcp-revocation.module';
import { MCP_ACTIVITY_REPOSITORY, MCP_TOOLS } from './mcp.tokens';

const TOOLS = [
  GetCurrentMonthTool,
  GetMonthTool,
  ListMonthsTool,
  SearchMovementsTool,
  ListSavingsGoalsTool,
  GetSavingsGoalOutlookTool,
  ListTemplatesTool,
  AddMovementTool,
  UpdateMovementTool,
  DeleteMovementTool,
  AddForecastTool,
  UpdateForecastTool,
  SpreadExpenseTool,
  CreateMonthFromTemplateTool,
  ToggleCheckTool,
];

@Module({
  imports: [
    McpRevocationModule,
    BudgetModule,
    BudgetLineModule,
    BudgetTemplateModule,
    CurrencyModule,
    UserModule,
    SavingsGoalModule,
    TransactionModule,
  ],
  controllers: [
    McpController,
    McpConsentController,
    McpConnectionsController,
    ProtectedResourceMetadataController,
  ],
  providers: [
    ListToolsUseCase,
    ResolveCurrencyUseCase,
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
