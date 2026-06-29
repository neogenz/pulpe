import { Module } from '@nestjs/common';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { AllocationBudgetLineController } from './infrastructure/http/allocation-budget-line.controller';
import { AllocationTransactionController } from './infrastructure/http/allocation-transaction.controller';
import { AllocationMapper } from './infrastructure/mappers/allocation.mapper';

@Module({
  imports: [BudgetLineModule, TransactionModule],
  controllers: [
    AllocationBudgetLineController,
    AllocationTransactionController,
  ],
  providers: [AllocationMapper],
})
export class AllocationModule {}
