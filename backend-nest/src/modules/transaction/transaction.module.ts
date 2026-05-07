import { Module } from '@nestjs/common';
import { BudgetModule } from '@modules/budget/budget.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { createInfoLoggerProvider } from '@common/logger';
import { TransactionController } from './infrastructure/http/transaction.controller';
import { SupabaseTransactionRepository } from './infrastructure/persistence/supabase-transaction.repository';
import { TransactionMapper } from './infrastructure/mappers/transaction.mapper';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction-repository.port';
import { FindAllTransactionsUseCase } from './application/find-all-transactions.use-case';
import { FindTransactionUseCase } from './application/find-transaction.use-case';
import { FindTransactionsByBudgetUseCase } from './application/find-transactions-by-budget.use-case';
import { FindTransactionsByBudgetLineUseCase } from './application/find-transactions-by-budget-line.use-case';
import { CreateTransactionUseCase } from './application/create-transaction.use-case';
import { UpdateTransactionUseCase } from './application/update-transaction.use-case';
import { RemoveTransactionUseCase } from './application/remove-transaction.use-case';
import { ToggleTransactionCheckUseCase } from './application/toggle-transaction-check.use-case';
import { SearchTransactionsUseCase } from './application/search-transactions.use-case';

@Module({
  imports: [BudgetModule, CurrencyModule, EncryptionModule],
  controllers: [TransactionController],
  providers: [
    FindAllTransactionsUseCase,
    FindTransactionUseCase,
    FindTransactionsByBudgetUseCase,
    FindTransactionsByBudgetLineUseCase,
    CreateTransactionUseCase,
    UpdateTransactionUseCase,
    RemoveTransactionUseCase,
    ToggleTransactionCheckUseCase,
    SearchTransactionsUseCase,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: SupabaseTransactionRepository,
    },
    TransactionMapper,
    createInfoLoggerProvider(TransactionController.name),
    createInfoLoggerProvider(FindAllTransactionsUseCase.name),
    createInfoLoggerProvider(FindTransactionUseCase.name),
    createInfoLoggerProvider(FindTransactionsByBudgetUseCase.name),
    createInfoLoggerProvider(FindTransactionsByBudgetLineUseCase.name),
    createInfoLoggerProvider(CreateTransactionUseCase.name),
    createInfoLoggerProvider(UpdateTransactionUseCase.name),
    createInfoLoggerProvider(RemoveTransactionUseCase.name),
    createInfoLoggerProvider(ToggleTransactionCheckUseCase.name),
    createInfoLoggerProvider(SearchTransactionsUseCase.name),
  ],
})
export class TransactionModule {}
