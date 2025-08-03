import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { ListTransactionsQuery } from '../queries/list-transactions.query';
import {
  TRANSACTION_REPOSITORY_TOKEN,
  type TransactionRepository,
  type TransactionListResult,
} from '../../domain/repositories';
import type { TransactionSnapshot } from '../../domain/entities/transaction.entity';

export interface ListTransactionsResult {
  transactions: TransactionSnapshot[];
  total: number;
}

@Injectable()
export class ListTransactionsHandler {
  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly repository: TransactionRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    query: ListTransactionsQuery,
  ): Promise<Result<ListTransactionsResult>> {
    const context = {
      userId: query.userId,
      filters: query.filters,
      pagination: query.pagination,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'ListTransactions',
      context,
      logFn: async () => {
        try {
          const result = await this.repository.findByUserId(
            query.userId,
            query.filters,
            query.pagination,
          );
          if (result.isFail()) {
            return Result.fail(result.error);
          }

          const { transactions, total } = result.value;
          const snapshots = transactions.map((t) => t.toSnapshot());

          return Result.ok<ListTransactionsResult>({
            transactions: snapshots,
            total,
          });
        } catch {
          this.logger.error({ error, context }, 'Failed to list transactions');
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
