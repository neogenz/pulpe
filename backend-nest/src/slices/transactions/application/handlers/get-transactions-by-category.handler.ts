import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { GetTransactionsByCategoryQuery } from '../queries/get-transactions-by-category.query';
import {
  TRANSACTION_REPOSITORY_TOKEN,
  type TransactionRepository,
} from '../../domain/repositories';
import type { TransactionSnapshot } from '../../domain/entities/transaction.entity';

@Injectable()
export class GetTransactionsByCategoryHandler {
  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly repository: TransactionRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    query: GetTransactionsByCategoryQuery,
  ): Promise<Result<TransactionSnapshot[]>> {
    const context = {
      category: query.category,
      userId: query.userId,
      pagination: query.pagination,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'GetTransactionsByCategory',
      context,
      logFn: async () => {
        try {
          const result = await this.repository.findByCategory(
            query.category,
            query.userId,
            query.pagination,
          );
          if (result.isFail()) {
            return Result.fail(result.error);
          }

          const transactions = result.value;
          const snapshots = transactions.map((t) => t.toSnapshot());

          return Result.ok(snapshots);
        } catch {
          this.logger.error(
            { error, context },
            'Failed to get transactions by category',
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
