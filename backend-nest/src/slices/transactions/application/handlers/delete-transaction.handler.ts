import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { DeleteTransactionCommand } from '../commands/delete-transaction.command';
import {
  TRANSACTION_REPOSITORY_TOKEN,
  type TransactionRepository,
} from '../../domain/repositories';
import { TransactionDeletedEvent } from '../../domain/events/transaction-deleted.event';

export interface DeleteTransactionResult {
  deleted: boolean;
  message: string;
}

@Injectable()
export class DeleteTransactionHandler {
  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly repository: TransactionRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: DeleteTransactionCommand,
  ): Promise<Result<DeleteTransactionResult>> {
    const context = {
      transactionId: command.id,
      userId: command.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'DeleteTransaction',
      context,
      logFn: async () => {
        try {
          // Find the transaction first to get its details for the event
          const findResult = await this.repository.findById(
            command.id,
            command.userId,
          );
          if (findResult.isFail()) {
            return Result.fail(findResult.error);
          }

          const transaction = findResult.value;
          if (!transaction) {
            return Result.fail(
              new GenericDomainException(
                'Transaction not found',
                'TRANSACTION_NOT_FOUND',
                `Transaction with ID ${command.id} not found`,
              ),
            );
          }

          // Delete the transaction
          const deleteResult = await this.repository.delete(
            command.id,
            command.userId,
          );
          if (deleteResult.isFail()) {
            return Result.fail(deleteResult.error);
          }

          // Log success
          this.logger.info(
            {
              transactionId: command.id,
              userId: command.userId,
              budgetId: transaction.budgetId,
              amount: transaction.amount.value,
              kind: transaction.kind,
            },
            'Transaction deleted successfully',
          );

          // Publish domain event
          const event = new TransactionDeletedEvent(
            transaction.id,
            command.userId,
            transaction.budgetId,
            transaction.amount.value,
            transaction.kind,
          );
          this.logger.debug({ event }, 'TransactionDeletedEvent published');

          return Result.ok<DeleteTransactionResult>({
            deleted: true,
            message: 'Transaction deleted successfully',
          });
        } catch {
          this.logger.error({ error, context }, 'Failed to delete transaction');
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
