import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BudgetLineController } from './infrastructure/api/budget-line.controller';
import { SupabaseBudgetLineRepository } from './infrastructure/persistence/supabase-budget-line.repository';
import { BudgetLineMapper } from './infrastructure/mappers/budget-line.mapper';
import { BudgetLineHandlers } from './application/handlers';
import { BUDGET_LINE_REPOSITORY_TOKEN } from './domain/repositories/budget-line.repository';

@Module({
  imports: [CqrsModule],
  controllers: [BudgetLineController],
  providers: [
    // Handlers
    ...BudgetLineHandlers,

    // Repository
    {
      provide: BUDGET_LINE_REPOSITORY_TOKEN,
      useClass: SupabaseBudgetLineRepository,
    },

    // Mapper
    BudgetLineMapper,
  ],
  exports: [BUDGET_LINE_REPOSITORY_TOKEN, BudgetLineMapper],
})
export class BudgetLineModule {}
