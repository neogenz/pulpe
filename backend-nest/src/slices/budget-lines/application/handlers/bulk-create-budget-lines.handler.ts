import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { BulkCreateBudgetLinesCommand } from '../commands/bulk-create-budget-lines.command';
import {
  type BudgetLineRepository,
  BUDGET_LINE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';
import { BudgetLineAmount } from '../../domain/value-objects/budget-line-amount.value-object';
import { BudgetLineCategory } from '../../domain/value-objects/budget-line-category.value-object';
import { BudgetLineCreatedEvent } from '../../domain/events/budget-line-created.event';

@Injectable()
@CommandHandler(BulkCreateBudgetLinesCommand)
export class BulkCreateBudgetLinesHandler
  implements ICommandHandler<BulkCreateBudgetLinesCommand>
{
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY_TOKEN)
    private readonly budgetLineRepository: BudgetLineRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BulkCreateBudgetLinesHandler.name);
  }

  async execute(
    command: BulkCreateBudgetLinesCommand,
  ): Promise<Result<BudgetLine[]>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'bulk-create-budget-lines.start',
      userId: command.userId,
      budgetId: command.budgetId,
      count: command.budgetLines.length,
    });

    try {
      // Validate all budget lines first
      const budgetLines: BudgetLine[] = [];
      const errors: string[] = [];

      for (let i = 0; i < command.budgetLines.length; i++) {
        const lineData = command.budgetLines[i];

        // Create value objects
        const amountResult = BudgetLineAmount.create(lineData.amount);
        if (amountResult.isFailure) {
          errors.push(`Line ${i + 1}: ${amountResult.error.message}`);
          continue;
        }

        const categoryResult = BudgetLineCategory.create({
          name: lineData.name,
          kind: lineData.kind,
          recurrence: lineData.recurrence,
          isManuallyAdjusted: lineData.isManuallyAdjusted ?? false,
        });
        if (categoryResult.isFailure) {
          errors.push(`Line ${i + 1}: ${categoryResult.error.message}`);
          continue;
        }

        // Create budget line entity
        const budgetLineResult = BudgetLine.create({
          budgetId: command.budgetId,
          templateLineId: lineData.templateLineId,
          savingsGoalId: lineData.savingsGoalId,
          category: categoryResult.getValue(),
          amount: amountResult.getValue(),
        });

        if (budgetLineResult.isFailure) {
          errors.push(`Line ${i + 1}: ${budgetLineResult.error.message}`);
          continue;
        }

        budgetLines.push(budgetLineResult.getValue());
      }

      // If any validation errors, fail the entire operation
      if (errors.length > 0) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'bulk-create-budget-lines.validation-failed',
          userId: command.userId,
          budgetId: command.budgetId,
          errors,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Budget lines validation failed',
            'VALIDATION_ERROR',
            errors.join('; '),
          ),
        );
      }

      // Save all budget lines in a transaction
      const saveResult = await this.budgetLineRepository.saveMany(
        budgetLines,
        command.userId,
      );
      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'bulk-create-budget-lines.save-failed',
          userId: command.userId,
          budgetId: command.budgetId,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      const savedBudgetLines = saveResult.getValue();

      // Emit domain events for each created budget line
      for (const budgetLine of savedBudgetLines) {
        const event = new BudgetLineCreatedEvent(
          budgetLine.id,
          budgetLine.budgetId,
          budgetLine.category.name,
          budgetLine.amount.value,
          budgetLine.category.kind,
          new Date(),
        );
        this.eventBus.publish(event);
      }

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'bulk-create-budget-lines.success',
        userId: command.userId,
        budgetId: command.budgetId,
        count: savedBudgetLines.length,
        duration,
      });

      return Result.ok(savedBudgetLines);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'bulk-create-budget-lines.error',
        userId: command.userId,
        budgetId: command.budgetId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to bulk create budget lines',
          'BULK_CREATE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
