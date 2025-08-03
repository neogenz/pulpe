import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { CreateTransactionCommand } from '../commands/create-transaction.command';
import {
  TRANSACTION_REPOSITORY_TOKEN,
  type TransactionRepository,
} from '../../domain/repositories';
import { Transaction } from '../../domain/entities/transaction.entity';
import { TransactionAmount } from '../../domain/value-objects/transaction-amount.value-object';
import { TransactionCreatedEvent } from '../../domain/events/transaction-created.event';

export interface CreateTransactionResult {
  id: string;
  budgetId: string;
  amount: number;
  name: string;
  kind: 'expense' | 'income';
  transactionDate: Date;
  isOutOfBudget: boolean;
  category: string | null;
  createdAt: Date;
}

@Injectable()
export class CreateTransactionHandler {
  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly repository: TransactionRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: CreateTransactionCommand,
  ): Promise<Result<CreateTransactionResult>> {
    const context = {
      userId: command.userId,
      budgetId: command.budgetId,
      amount: command.amount,
      kind: command.kind,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'CreateTransaction',
      context,
      logFn: async () => {
        try {
          // Verify user owns the budget
          const ownsResult = await this.repository.userOwnsBudget(
            command.budgetId,
            command.userId,
          );
          if (ownsResult.isFail()) {
            return Result.fail(ownsResult.error);
          }

          if (!ownsResult.value) {
            return Result.fail(
              new GenericDomainException(
                'Budget not found or access denied',
                'BUDGET_NOT_FOUND',
                'The specified budget does not exist or you do not have access to it',
              ),
            );
          }

          // Create TransactionAmount value object
          const amountResult = TransactionAmount.create(command.amount);
          if (amountResult.isFail()) {
            return Result.fail(amountResult.error);
          }

          // Parse transaction date
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

          // Create Transaction entity
          const transactionResult = Transaction.create({
            budgetId: command.budgetId,
            amount: amountResult.value,
            name: command.name,
            kind: command.kind,
            transactionDate,
            isOutOfBudget: command.isOutOfBudget,
            category: command.category,
          });

          if (transactionResult.isFail()) {
            return Result.fail(transactionResult.error);
          }

          const transaction = transactionResult.value;

          // Business rule: Out of budget transactions should not have a category
          if (command.isOutOfBudget && command.category) {
            transaction.markAsOutOfBudget();
          }

          // Save transaction
          const saveResult = await this.repository.save(transaction);
          if (saveResult.isFail()) {
            return Result.fail(saveResult.error);
          }

          // Log success
          this.logger.info(
            {
              transactionId: transaction.id,
              userId: command.userId,
              budgetId: command.budgetId,
              amount: command.amount,
              kind: command.kind,
              category: transaction.category,
            },
            'Transaction created successfully',
          );

          // Publish domain event
          const event = new TransactionCreatedEvent(
            transaction.id,
            command.userId,
            transaction.budgetId,
            transaction.amount.value,
            transaction.kind,
            transaction.category,
          );
          this.logger.debug({ event }, 'TransactionCreatedEvent published');

          const snapshot = transaction.toSnapshot();
          return Result.ok<CreateTransactionResult>({
            id: snapshot.id,
            budgetId: snapshot.budgetId,
            amount: snapshot.amount,
            name: snapshot.name,
            kind: snapshot.kind,
            transactionDate: snapshot.transactionDate,
            isOutOfBudget: snapshot.isOutOfBudget,
            category: snapshot.category,
            createdAt: snapshot.createdAt,
          });
        } catch {
          this.logger.error({ error, context }, 'Failed to create transaction');
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
