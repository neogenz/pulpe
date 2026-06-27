import { forwardRef, Module } from '@nestjs/common';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
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
import { PostponeTransactionUseCase } from './application/postpone-transaction.use-case';
import { SpreadTransactionFromTxnUseCase } from './application/spread-transaction-from-txn.use-case';

@Module({
  imports: [
    BudgetModule,
    // forwardRef: BudgetLineModule imports TransactionModule (for TransactionMapper),
    // and this module needs BUDGET_LINE_SPREAD_PORT + BudgetLineMapper from it.
    //
    // TRADE-OFF (interim — PUL-288): this budget-line ↔ transaction cycle is a
    // documented violation of `no-cross-module-direct` (ADR-0002), caused by the
    // cross-module mapper imports on both sides. `forwardRef` is the accepted
    // controlled-coupling stop-gap UNTIL PUL-288 extracts an `allocation` domain
    // module both sides depend on one-way — at which point this forwardRef is
    // removed and the lint rule is promoted warn→error. Do NOT build on this cycle.
    forwardRef(() => BudgetLineModule),
    CurrencyModule,
    EncryptionModule,
  ],
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
    PostponeTransactionUseCase,
    SpreadTransactionFromTxnUseCase,
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
    createInfoLoggerProvider(PostponeTransactionUseCase.name),
    createInfoLoggerProvider(SpreadTransactionFromTxnUseCase.name),
  ],
  exports: [TransactionMapper],
})
export class TransactionModule {}
