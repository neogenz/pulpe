import { Module } from '@nestjs/common';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';

// Domain
import { BUDGET_REPOSITORY_TOKEN } from './domain/repositories';

// Application - Command Handlers
import { CreateBudgetHandler } from './application/handlers/create-budget.handler';
import { UpdateBudgetHandler } from './application/handlers/update-budget.handler';
import { DeleteBudgetHandler } from './application/handlers/delete-budget.handler';

// Application - Query Handlers
import { GetBudgetHandler } from './application/handlers/get-budget.handler';
import { ListBudgetsHandler } from './application/handlers/list-budgets.handler';
import { GetBudgetByPeriodHandler } from './application/handlers/get-budget-by-period.handler';

// Infrastructure
import { BudgetController } from './infrastructure/api/budget.controller';
import { SupabaseBudgetRepository } from './infrastructure/persistence/supabase-budget.repository';
import { BudgetMapper } from './infrastructure/mappers/budget.mapper';

@Module({
  controllers: [BudgetController],
  providers: [
    // Infrastructure
    BudgetMapper,
    {
      provide: BUDGET_REPOSITORY_TOKEN,
      useClass: SupabaseBudgetRepository,
    },
    SupabaseBudgetRepository, // Also provide the concrete class for direct injection
    EnhancedLoggerService,

    // Command Handlers
    CreateBudgetHandler,
    UpdateBudgetHandler,
    DeleteBudgetHandler,

    // Query Handlers
    GetBudgetHandler,
    ListBudgetsHandler,
    GetBudgetByPeriodHandler,
  ],
  exports: [BUDGET_REPOSITORY_TOKEN, BudgetMapper],
})
export class BudgetSliceModule {}
