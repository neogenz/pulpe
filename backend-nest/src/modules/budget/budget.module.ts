import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetCalculator } from './budget.calculator';
import { BudgetValidator } from './budget.validator';
import { BudgetRepository } from './budget.repository';

@Module({
  controllers: [BudgetController],
  providers: [
    BudgetService,
    BudgetCalculator,
    BudgetValidator,
    BudgetRepository,
  ],
  exports: [BudgetService],
})
export class BudgetModule {}
