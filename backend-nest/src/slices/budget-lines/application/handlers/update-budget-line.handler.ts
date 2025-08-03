import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { UpdateBudgetLineCommand } from '../commands/update-budget-line.command';
import {
  type BudgetLineRepository,
  BUDGET_LINE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';
import { BudgetLineAmount } from '../../domain/value-objects/budget-line-amount.value-object';
import { BudgetLineCategory } from '../../domain/value-objects/budget-line-category.value-object';
import { BudgetLineUpdatedEvent } from '../../domain/events/budget-line-updated.event';

@Injectable()
@CommandHandler(UpdateBudgetLineCommand)
export class UpdateBudgetLineHandler
  implements ICommandHandler<UpdateBudgetLineCommand>
{
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY_TOKEN)
    private readonly budgetLineRepository: BudgetLineRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateBudgetLineHandler.name);
  }

  async execute(command: UpdateBudgetLineCommand): Promise<Result<BudgetLine>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'update-budget-line.start',
      userId: command.userId,
      budgetLineId: command.id,
    });

    try {
      // Find existing budget line
      const findResult = await this.budgetLineRepository.findById(
        command.id,
        command.userId,
      );
      if (findResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'update-budget-line.not-found',
          userId: command.userId,
          budgetLineId: command.id,
          error: findResult.error.message,
          duration,
        });
        return Result.fail(findResult.error);
      }

      const budgetLine = findResult.getValue();
      if (!budgetLine) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'update-budget-line.not-found',
          userId: command.userId,
          budgetLineId: command.id,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Budget line not found',
            'BUDGET_LINE_NOT_FOUND',
            `Budget line with ID ${command.id} not found`,
          ),
        );
      }

      const changes: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ =
        {};

      // Update amount if provided
      if (command.amount !== undefined) {
        const amountResult = BudgetLineAmount.create(command.amount);
        if (amountResult.isFailure) {
          const duration = performance.now() - startTime;
          this.logger.warn({
            operation: 'update-budget-line.invalid-amount',
            userId: command.userId,
            amount: command.amount,
            error: amountResult.error.message,
            duration,
          });
          return Result.fail(amountResult.error);
        }

        const updateResult = budgetLine.updateAmount(amountResult.getValue());
        if (updateResult.isFailure) {
          return Result.fail(updateResult.error);
        }
        changes.amount = command.amount;
      }

      // Update category if any category field is provided
      if (
        command.name !== undefined ||
        command.kind !== undefined ||
        command.recurrence !== undefined ||
        command.isManuallyAdjusted !== undefined
      ) {
        const categoryResult = BudgetLineCategory.create({
          name: command.name ?? budgetLine.category.name,
          kind: command.kind ?? budgetLine.category.kind,
          recurrence: command.recurrence ?? budgetLine.category.recurrence,
          isManuallyAdjusted:
            command.isManuallyAdjusted ??
            budgetLine.category.isManuallyAdjusted,
        });

        if (categoryResult.isFailure) {
          const duration = performance.now() - startTime;
          this.logger.warn({
            operation: 'update-budget-line.invalid-category',
            userId: command.userId,
            error: categoryResult.error.message,
            duration,
          });
          return Result.fail(categoryResult.error);
        }

        const updateResult = budgetLine.updateCategory(
          categoryResult.getValue(),
        );
        if (updateResult.isFailure) {
          return Result.fail(updateResult.error);
        }

        if (command.name !== undefined) changes.name = command.name;
        if (command.kind !== undefined) changes.kind = command.kind;
        if (command.recurrence !== undefined)
          changes.recurrence = command.recurrence;
        if (command.isManuallyAdjusted !== undefined)
          changes.isManuallyAdjusted = command.isManuallyAdjusted;
      }

      // Update savings goal link if provided
      if (command.savingsGoalId !== undefined) {
        if (command.savingsGoalId === null) {
          budgetLine.unlinkFromSavingsGoal();
        } else {
          const linkResult = budgetLine.linkToSavingsGoal(
            command.savingsGoalId,
          );
          if (linkResult.isFailure) {
            return Result.fail(linkResult.error);
          }
        }
        changes.savingsGoalId = command.savingsGoalId;
      }

      // Save updated budget line
      const saveResult = await this.budgetLineRepository.save(
        budgetLine,
        command.userId,
      );
      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'update-budget-line.save-failed',
          userId: command.userId,
          budgetLineId: command.id,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      const savedBudgetLine = saveResult.getValue();

      // Emit domain event
      const event = new BudgetLineUpdatedEvent(
        savedBudgetLine.id,
        savedBudgetLine.budgetId,
        changes,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'update-budget-line.success',
        userId: command.userId,
        budgetLineId: savedBudgetLine.id,
        changes,
        duration,
      });

      return Result.ok(savedBudgetLine);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'update-budget-line.error',
        userId: command.userId,
        budgetLineId: command.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to update budget line',
          'UPDATE_BUDGET_LINE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
