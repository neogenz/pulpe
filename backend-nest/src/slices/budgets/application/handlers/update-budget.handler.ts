import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { UpdateBudgetCommand } from '../commands/update-budget.command';
import {
  BUDGET_REPOSITORY_TOKEN,
  type BudgetRepository,
} from '../../domain/repositories';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { BudgetUpdatedEvent } from '../../domain/events/budget-updated.event';
import { BudgetSnapshot } from '../../domain/entities/budget.entity';

@Injectable()
export class UpdateBudgetHandler {
  constructor(
    @Inject(BUDGET_REPOSITORY_TOKEN)
    private readonly repository: BudgetRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(command: UpdateBudgetCommand): Promise<Result<BudgetSnapshot>> {
    const context = {
      budgetId: command.budgetId,
      userId: command.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'UpdateBudget',
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
                'You do not have permission to update this budget',
              ),
            );
          }

          // Check if budget is editable
          if (!budget.isEditable()) {
            return Result.fail(
              new GenericDomainException(
                'Budget not editable',
                'BUDGET_NOT_EDITABLE',
                'Past budgets cannot be modified',
              ),
            );
          }

          const changes: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ =
            {};
          let hasChanges = false;

          // Update description if provided
          if (command.description !== undefined) {
            const updateResult = budget.updateDescription(command.description);
            if (updateResult.isFail()) {
              return Result.fail(updateResult.error);
            }
            changes.description = command.description;
            hasChanges = true;
          }

          // Update period if provided
          if (command.month !== undefined && command.year !== undefined) {
            const periodResult = BudgetPeriod.create(
              command.month,
              command.year,
            );
            if (periodResult.isFail()) {
              return Result.fail(periodResult.error);
            }
            const newPeriod = periodResult.value;

            // Check if new period already has a budget
            const existsResult = await this.repository.existsForPeriod(
              newPeriod,
              command.userId,
              command.budgetId, // Exclude current budget
            );

            if (existsResult.isFail()) {
              return Result.fail(existsResult.error);
            }

            if (existsResult.value) {
              return Result.fail(
                new GenericDomainException(
                  'Budget already exists for this period',
                  'BUDGET_ALREADY_EXISTS',
                  `A budget for ${newPeriod.toString()} already exists`,
                ),
              );
            }

            const updateResult = budget.updatePeriod(newPeriod);
            if (updateResult.isFail()) {
              return Result.fail(updateResult.error);
            }
            changes.month = command.month;
            changes.year = command.year;
            hasChanges = true;
          }

          // Save if there were changes
          if (hasChanges) {
            const saveResult = await this.repository.save(budget);
            if (saveResult.isFail()) {
              return Result.fail(saveResult.error);
            }

            // Publish domain event
            const event = new BudgetUpdatedEvent(
              budget.id,
              budget.userId,
              changes,
            );
            this.logger.debug({ event }, 'BudgetUpdatedEvent published');

            this.logger.info(
              {
                budgetId: budget.id,
                userId: budget.userId,
                changes,
              },
              'Budget updated successfully',
            );
          } else {
            this.logger.info({ budgetId: budget.id }, 'No changes to update');
          }

          return Result.ok(budget.toSnapshot());
        } catch {
          this.logger.error({ error, context }, 'Failed to update budget');
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
