import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetCalculator } from './budget.calculator';
import { BudgetValidator } from './budget.validator';
import { BudgetRepository } from './budget.repository';
import { createInfoLoggerProvider } from '@common/logger';

@Module({
  controllers: [BudgetController],
  providers: [
    BudgetService,
    BudgetCalculator,
    BudgetValidator,
    BudgetRepository,
    createInfoLoggerProvider(BudgetService.name),
  ],
  exports: [BudgetService, BudgetCalculator],
})
export class BudgetModule {}
