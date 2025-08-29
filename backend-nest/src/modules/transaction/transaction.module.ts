import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { BudgetModule } from '@modules/budget/budget.module';

@Module({
  imports: [BudgetModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
