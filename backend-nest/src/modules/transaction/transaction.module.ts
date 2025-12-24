import { Module, forwardRef } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';

@Module({
  imports: [BudgetModule, forwardRef(() => BudgetLineModule)],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
