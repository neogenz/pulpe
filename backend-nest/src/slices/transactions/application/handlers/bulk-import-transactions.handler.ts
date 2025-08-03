import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { BulkImportTransactionsCommand } from '../commands/bulk-import-transactions.command';
import {
  TRANSACTION_REPOSITORY_TOKEN,
  type TransactionRepository,
  type BulkImportResult,
} from '../../domain/repositories';
import { Transaction } from '../../domain/entities/transaction.entity';
import { TransactionAmount } from '../../domain/value-objects/transaction-amount.value-object';

@Injectable()
export class BulkImportTransactionsHandler {
  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly repository: TransactionRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: BulkImportTransactionsCommand,
  ): Promise<Result<BulkImportResult>> {
    const context = {
      userId: command.userId,
      transactionCount: command.transactions.length,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'BulkImportTransactions',
      context,
      logFn: async () => {
        try {
          const transactions: Transaction[] = [];
          const errors: Array<{ row: number; error: string }> = [];

          // Validate and create transaction entities
          for (let i = 0; i < command.transactions.length; i++) {
            const importedTx = command.transactions[i];
            const row = i + 1;

            try {
              // Verify user owns the budget
              const ownsResult = await this.repository.userOwnsBudget(
                importedTx.budgetId,
                command.userId,
              );
              if (ownsResult.isFail() || !ownsResult.value) {
                errors.push({
                  row,
                  error: `Budget ${importedTx.budgetId} not found or access denied`,
                });
                continue;
              }

              // Create amount value object
              const amountResult = TransactionAmount.create(importedTx.amount);
              if (amountResult.isFail()) {
                errors.push({
                  row,
                  error: amountResult.error.message,
                });
                continue;
              }

              // Parse transaction date
              const transactionDate = new Date(importedTx.transactionDate);
              if (isNaN(transactionDate.getTime())) {
                errors.push({
                  row,
                  error: 'Invalid transaction date',
                });
                continue;
              }

              // Create transaction entity
              const transactionResult = Transaction.create({
                budgetId: importedTx.budgetId,
                amount: amountResult.value,
                name: importedTx.name,
                kind: importedTx.kind,
                transactionDate,
                isOutOfBudget: importedTx.isOutOfBudget,
                category: importedTx.category,
              });

              if (transactionResult.isFail()) {
                errors.push({
                  row,
                  error: transactionResult.error.message,
                });
                continue;
              }

              const transaction = transactionResult.value;

              // Business rule: Out of budget transactions should not have a category
              if (importedTx.isOutOfBudget && importedTx.category) {
                transaction.markAsOutOfBudget();
              }

              transactions.push(transaction);
            } catch {
              errors.push({
                row,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }

          // If no valid transactions, return early
          if (transactions.length === 0) {
            return Result.ok<BulkImportResult>({
              imported: 0,
              failed: errors.length,
              errors,
            });
          }

          // Bulk import valid transactions
          const importResult = await this.repository.bulkImport(
            transactions,
            command.userId,
          );
          if (importResult.isFail()) {
            return Result.fail(importResult.error);
          }

          const result = importResult.value;

          // Merge errors
          const allErrors = [...errors, ...result.errors];

          // Log results
          this.logger.info(
            {
              userId: command.userId,
              totalTransactions: command.transactions.length,
              imported: result.imported,
              failed: allErrors.length,
            },
            'Bulk import completed',
          );

          if (allErrors.length > 0) {
            this.logger.warn(
              {
                userId: command.userId,
                errors: allErrors.slice(0, 10), // Log first 10 errors
                totalErrors: allErrors.length,
              },
              'Some transactions failed during import',
            );
          }

          return Result.ok<BulkImportResult>({
            imported: result.imported,
            failed: allErrors.length,
            errors: allErrors,
          });
        } catch {
          this.logger.error(
            { error, context },
            'Failed to bulk import transactions',
          );
          return Result.fail(
            error instanceof Error
              ? error
              : new Error('Unknown error occurred'),
          );
        }
      },
    });

    return operationResult;
  }
}
