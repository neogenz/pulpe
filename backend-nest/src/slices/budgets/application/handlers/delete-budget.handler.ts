import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { DeleteBudgetCommand } from '../commands/delete-budget.command';
import {
  BUDGET_REPOSITORY_TOKEN,
  type BudgetRepository,
} from '../../domain/repositories';
import { BudgetDeletedEvent } from '../../domain/events/budget-deleted.event';

export interface DeleteBudgetResult {
  success: boolean;
  message: string;
}

@Injectable()
export class DeleteBudgetHandler {
  constructor(
    @Inject(BUDGET_REPOSITORY_TOKEN)
    private readonly repository: BudgetRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: DeleteBudgetCommand,
  ): Promise<Result<DeleteBudgetResult>> {
    const context = {
      budgetId: command.budgetId,
      userId: command.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'DeleteBudget',
      context,
      logFn: async () => {
        try {
          // Find the budget
          const findResult = await this.repository.findById(
            command.budgetId,
            command.userId,
          );

          if (findResult.isFail()) {
            return Result.fail(findResult.error);
          }

          const budget = findResult.value;
          if (!budget) {
            return Result.fail(
              new GenericDomainException(
                'Budget not found',
                'BUDGET_NOT_FOUND',
                `Budget ${command.budgetId} not found`,
              ),
            );
          }

          // Check ownership
          if (budget.userId !== command.userId) {
            return Result.fail(
              new GenericDomainException(
                'Unauthorized',
                'UNAUTHORIZED_ACCESS',
                'You do not have permission to delete this budget',
              ),
            );
          }

          // Check if budget can be deleted
          if (!budget.canBeDeleted()) {
            return Result.fail(
              new GenericDomainException(
                'Budget cannot be deleted',
                'BUDGET_NOT_DELETABLE',
                'Past budgets cannot be deleted for audit purposes',
              ),
            );
          }

          // Delete the budget
          const deleteResult = await this.repository.delete(
            command.budgetId,
            command.userId,
          );

          if (deleteResult.isFail()) {
            return Result.fail(deleteResult.error);
          }

          // Publish domain event
          const event = new BudgetDeletedEvent(
            budget.id,
            budget.userId,
            budget.period.month,
            budget.period.year,
          );
          this.logger.debug({ event }, 'BudgetDeletedEvent published');

          this.logger.info(
            {
              budgetId: budget.id,
              userId: budget.userId,
              period: budget.period.toString(),
            },
            'Budget deleted successfully',
          );

          return Result.ok<DeleteBudgetResult>({
            success: true,
            message: 'Budget deleted successfully',
          });
        } catch {
          this.logger.error({ error, context }, 'Failed to delete budget');
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
