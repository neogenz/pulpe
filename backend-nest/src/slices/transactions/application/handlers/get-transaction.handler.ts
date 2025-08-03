import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { DomainException } from '@shared/domain/exceptions/domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { GetTransactionQuery } from '../queries/get-transaction.query';
import {
  TRANSACTION_REPOSITORY_TOKEN,
  type TransactionRepository,
} from '../../domain/repositories';
import type { TransactionSnapshot } from '../../domain/entities/transaction.entity';

@Injectable()
export class GetTransactionHandler {
  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly repository: TransactionRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    query: GetTransactionQuery,
  ): Promise<Result<TransactionSnapshot | null>> {
    const context = {
      transactionId: query.id,
      userId: query.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'GetTransaction',
      context,
      logFn: async () => {
        try {
          const result = await this.repository.findById(query.id, query.userId);
          if (result.isFail()) {
            return Result.fail(result.error);
          }

          const transaction = result.value;
          if (!transaction) {
            return Result.ok(null);
          }

          return Result.ok(transaction.toSnapshot());
        } catch {
          this.logger.error({ error, context }, 'Failed to get transaction');
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
