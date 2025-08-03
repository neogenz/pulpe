import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { CreateBudgetLineCommand } from '../commands/create-budget-line.command';
import {
  type BudgetLineRepository,
  BUDGET_LINE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';
import { BudgetLineAmount } from '../../domain/value-objects/budget-line-amount.value-object';
import { BudgetLineCategory } from '../../domain/value-objects/budget-line-category.value-object';
import { BudgetLineCreatedEvent } from '../../domain/events/budget-line-created.event';

@Injectable()
@CommandHandler(CreateBudgetLineCommand)
export class CreateBudgetLineHandler
  implements ICommandHandler<CreateBudgetLineCommand>
{
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY_TOKEN)
    private readonly budgetLineRepository: BudgetLineRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateBudgetLineHandler.name);
  }

  async execute(command: CreateBudgetLineCommand): Promise<Result<BudgetLine>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'create-budget-line.start',
      userId: command.userId,
      budgetId: command.budgetId,
      name: command.name,
    });

    try {
      // Create value objects
      const amountResult = BudgetLineAmount.create(command.amount);
      if (amountResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'create-budget-line.invalid-amount',
          userId: command.userId,
          amount: command.amount,
          error: amountResult.error.message,
          duration,
        });
        return Result.fail(amountResult.error);
      }

      const categoryResult = BudgetLineCategory.create({
        name: command.name,
        kind: command.kind,
        recurrence: command.recurrence,
        isManuallyAdjusted: command.isManuallyAdjusted ?? false,
      });
      if (categoryResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'create-budget-line.invalid-category',
          userId: command.userId,
          name: command.name,
          error: categoryResult.error.message,
          duration,
        });
        return Result.fail(categoryResult.error);
      }

      // Create budget line entity
      const budgetLineResult = BudgetLine.create({
        budgetId: command.budgetId,
        templateLineId: command.templateLineId,
        savingsGoalId: command.savingsGoalId,
        category: categoryResult.getValue(),
        amount: amountResult.getValue(),
      });

      if (budgetLineResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'create-budget-line.invalid-entity',
          userId: command.userId,
          error: budgetLineResult.error.message,
          duration,
        });
        return Result.fail(budgetLineResult.error);
      }

      const budgetLine = budgetLineResult.getValue();

      // Save to repository
      const saveResult = await this.budgetLineRepository.save(
        budgetLine,
        command.userId,
      );
      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'create-budget-line.save-failed',
          userId: command.userId,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      const savedBudgetLine = saveResult.getValue();

      // Emit domain event
      const event = new BudgetLineCreatedEvent(
        savedBudgetLine.id,
        savedBudgetLine.budgetId,
        savedBudgetLine.category.name,
        savedBudgetLine.amount.value,
        savedBudgetLine.category.kind,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'create-budget-line.success',
        userId: command.userId,
        budgetLineId: savedBudgetLine.id,
        budgetId: savedBudgetLine.budgetId,
        duration,
      });

      return Result.ok(savedBudgetLine);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'create-budget-line.error',
        userId: command.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to create budget line',
          'CREATE_BUDGET_LINE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
