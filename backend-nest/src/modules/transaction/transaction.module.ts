import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { BudgetModule } from '@modules/budget/budget.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseTransactionRepository } from './infrastructure/persistence/supabase-transaction.repository';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction-repository.port';

@Module({
  imports: [BudgetModule, CurrencyModule],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: SupabaseTransactionRepository,
    },
    createInfoLoggerProvider(TransactionService.name),
  ],
})
export class TransactionModule {}
