import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetMapper } from './budget.mapper';
import { TransactionMapper } from '../transaction/transaction.mapper';
import { BudgetLineMapper } from '../budget-line/budget-line.mapper';

@Module({
  controllers: [BudgetController],
  providers: [BudgetService, BudgetMapper, TransactionMapper, BudgetLineMapper],
})
export class BudgetModule {}
