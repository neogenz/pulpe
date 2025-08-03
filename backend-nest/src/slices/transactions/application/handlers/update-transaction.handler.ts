import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { UpdateTransactionCommand } from '../commands/update-transaction.command';
import {
  TRANSACTION_REPOSITORY_TOKEN,
  type TransactionRepository,
} from '../../domain/repositories';
import { TransactionAmount } from '../../domain/value-objects/transaction-amount.value-object';
import { TransactionUpdatedEvent } from '../../domain/events/transaction-updated.event';

export interface UpdateTransactionResult {
  id: string;
  budgetId: string;
  amount: number;
  name: string;
  kind: 'expense' | 'income';
  transactionDate: Date;
  isOutOfBudget: boolean;
  category: string | null;
  updatedAt: Date;
}

@Injectable()
export class UpdateTransactionHandler {
  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly repository: TransactionRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: UpdateTransactionCommand,
  ): Promise<Result<UpdateTransactionResult>> {
    const context = {
      transactionId: command.id,
      userId: command.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'UpdateTransaction',
      context,
      logFn: async () => {
        try {
          // Find the transaction
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

          const changes: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ =
            {};

          // Update amount if provided
          if (command.amount !== undefined) {
            const amountResult = TransactionAmount.create(command.amount);
            if (amountResult.isFail()) {
              return Result.fail(amountResult.error);
            }
            const updateResult = transaction.updateAmount(amountResult.value);
            if (updateResult.isFail()) {
              return Result.fail(updateResult.error);
            }
            changes.amount = command.amount;
          }

          // Update name if provided
          if (command.name !== undefined) {
            const updateResult = transaction.updateName(command.name);
            if (updateResult.isFail()) {
              return Result.fail(updateResult.error);
            }
            changes.name = command.name;
          }

          // Update kind if provided
          if (command.kind !== undefined) {
            const updateResult = transaction.updateKind(command.kind);
            if (updateResult.isFail()) {
              return Result.fail(updateResult.error);
            }
            changes.kind = command.kind;
          }

          // Update transaction date if provided
          if (command.transactionDate !== undefined) {
            const transactionDate = new Date(command.transactionDate);
            if (isNaN(transactionDate.getTime())) {
              return Result.fail(
                new GenericDomainException(
                  'Invalid transaction date',
                  'INVALID_DATE',
                  'The provided transaction date is not valid',
                ),
              );
            }
            const updateResult =
              transaction.updateTransactionDate(transactionDate);
            if (updateResult.isFail()) {
              return Result.fail(updateResult.error);
            }
            changes.transactionDate = command.transactionDate;
          }

          // Update out of budget status if provided
          if (command.isOutOfBudget !== undefined) {
            if (command.isOutOfBudget) {
              transaction.markAsOutOfBudget();
            } else {
              transaction.markAsInBudget();
            }
            changes.isOutOfBudget = command.isOutOfBudget;
          }

          // Update category if provided
          if (command.category !== undefined) {
            // Business rule: Can't set category on out of budget transactions
            if (transaction.isOutOfBudget && command.category !== null) {
              return Result.fail(
                new GenericDomainException(
                  'Cannot categorize out of budget transaction',
                  'INVALID_CATEGORY_UPDATE',
                  'Out of budget transactions cannot have a category',
                ),
              );
            }
            const updateResult = transaction.updateCategory(command.category);
            if (updateResult.isFail()) {
              return Result.fail(updateResult.error);
            }
            changes.category = command.category;
          }

          // Save updated transaction
          const saveResult = await this.repository.save(transaction);
          if (saveResult.isFail()) {
            return Result.fail(saveResult.error);
          }

          // Log success
          this.logger.info(
            {
              transactionId: transaction.id,
              userId: command.userId,
              changes,
            },
            'Transaction updated successfully',
          );

          // Publish domain event
          const event = new TransactionUpdatedEvent(
            transaction.id,
            command.userId,
            transaction.budgetId,
            changes,
          );
          this.logger.debug({ event }, 'TransactionUpdatedEvent published');

          const snapshot = transaction.toSnapshot();
          return Result.ok<UpdateTransactionResult>({
            id: snapshot.id,
            budgetId: snapshot.budgetId,
            amount: snapshot.amount,
            name: snapshot.name,
            kind: snapshot.kind,
            transactionDate: snapshot.transactionDate,
            isOutOfBudget: snapshot.isOutOfBudget,
            category: snapshot.category,
            updatedAt: snapshot.updatedAt,
          });
        } catch {
          this.logger.error({ error, context }, 'Failed to update transaction');
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
