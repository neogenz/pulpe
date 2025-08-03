import { Module } from '@nestjs/common';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';

// Domain
import { TRANSACTION_REPOSITORY_TOKEN } from './domain/repositories';

// Application - Command Handlers
import { CreateTransactionHandler } from './application/handlers/create-transaction.handler';
import { UpdateTransactionHandler } from './application/handlers/update-transaction.handler';
import { DeleteTransactionHandler } from './application/handlers/delete-transaction.handler';
import { BulkImportTransactionsHandler } from './application/handlers/bulk-import-transactions.handler';

// Application - Query Handlers
import { GetTransactionHandler } from './application/handlers/get-transaction.handler';
import { ListTransactionsHandler } from './application/handlers/list-transactions.handler';
import { GetTransactionsByBudgetHandler } from './application/handlers/get-transactions-by-budget.handler';
import { GetTransactionsByCategoryHandler } from './application/handlers/get-transactions-by-category.handler';

// Infrastructure
import { TransactionController } from './infrastructure/api/transaction.controller';
import { SupabaseTransactionRepository } from './infrastructure/persistence/supabase-transaction.repository';
import { TransactionMapper } from './infrastructure/mappers/transaction.mapper';

@Module({
  controllers: [TransactionController],
  providers: [
    // Infrastructure
    TransactionMapper,
    {
      provide: TRANSACTION_REPOSITORY_TOKEN,
      useClass: SupabaseTransactionRepository,
    },
    SupabaseTransactionRepository, // Also provide the concrete class for direct injection
    EnhancedLoggerService,

    // Command Handlers
    CreateTransactionHandler,
    UpdateTransactionHandler,
    DeleteTransactionHandler,
    BulkImportTransactionsHandler,

    // Query Handlers
    GetTransactionHandler,
    ListTransactionsHandler,
    GetTransactionsByBudgetHandler,
    GetTransactionsByCategoryHandler,
  ],
  exports: [TRANSACTION_REPOSITORY_TOKEN, TransactionMapper],
})
export class TransactionSliceModule {}
