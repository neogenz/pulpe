import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { BudgetModule } from '@modules/budget/budget.module';
import { createInfoLoggerProvider } from '@common/logger';

@Module({
  imports: [BudgetModule],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    createInfoLoggerProvider(TransactionService.name),
  ],
})
export class TransactionModule {}
