import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { BudgetModule } from '@modules/budget/budget.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { UserModule } from '@modules/user/user.module';
import { TransactionImportController } from './infrastructure/http/transaction-import.controller';
import { SupabaseTransactionImportRepository } from './infrastructure/persistence/supabase-transaction-import.repository';
import { Camt053Parser } from './infrastructure/parsers/camt053.parser';
import { STATEMENT_PARSERS } from './domain/ports/statement-parser.port';
import { TRANSACTION_IMPORT_REPOSITORY } from './domain/ports/transaction-import-repository.port';
import { TransactionImportAnalyzer } from './application/transaction-import-analyzer';
import { PreviewTransactionImportUseCase } from './application/preview-transaction-import.use-case';
import { ConfirmTransactionImportUseCase } from './application/confirm-transaction-import.use-case';

/**
 * Bank export import (PUL-25). A new format is one more `StatementParser`
 * appended to `STATEMENT_PARSERS`; nothing else changes.
 */
@Module({
  imports: [BudgetModule, EncryptionModule, UserModule],
  controllers: [TransactionImportController],
  providers: [
    Camt053Parser,
    {
      provide: STATEMENT_PARSERS,
      useFactory: (camt053: Camt053Parser) => [camt053],
      inject: [Camt053Parser],
    },
    {
      provide: TRANSACTION_IMPORT_REPOSITORY,
      useClass: SupabaseTransactionImportRepository,
    },
    TransactionImportAnalyzer,
    PreviewTransactionImportUseCase,
    ConfirmTransactionImportUseCase,
    createInfoLoggerProvider(TransactionImportAnalyzer.name),
    createInfoLoggerProvider(ConfirmTransactionImportUseCase.name),
  ],
})
export class TransactionImportModule {}
