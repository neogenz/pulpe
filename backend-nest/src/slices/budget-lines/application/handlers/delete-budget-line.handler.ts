import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { DeleteBudgetLineCommand } from '../commands/delete-budget-line.command';
import {
  type BudgetLineRepository,
  BUDGET_LINE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLineDeletedEvent } from '../../domain/events/budget-line-deleted.event';

@Injectable()
@CommandHandler(DeleteBudgetLineCommand)
export class DeleteBudgetLineHandler
  implements ICommandHandler<DeleteBudgetLineCommand>
{
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY_TOKEN)
    private readonly budgetLineRepository: BudgetLineRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DeleteBudgetLineHandler.name);
  }

  async execute(command: DeleteBudgetLineCommand): Promise<Result<void>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'delete-budget-line.start',
      userId: command.userId,
      budgetLineId: command.id,
    });

    try {
      // Find budget line to get budgetId for the event
      const findResult = await this.budgetLineRepository.findById(
        command.id,
        command.userId,
      );
      if (findResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'delete-budget-line.not-found',
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
          operation: 'delete-budget-line.not-found',
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

      // Check if can be deleted
      if (!budgetLine.canBeDeleted()) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'delete-budget-line.cannot-delete',
          userId: command.userId,
          budgetLineId: command.id,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Budget line cannot be deleted',
            'CANNOT_DELETE_BUDGET_LINE',
            'This budget line cannot be deleted due to business constraints',
          ),
        );
      }

      // Delete from repository
      const deleteResult = await this.budgetLineRepository.delete(
        command.id,
        command.userId,
      );
      if (deleteResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'delete-budget-line.delete-failed',
          userId: command.userId,
          budgetLineId: command.id,
          error: deleteResult.error.message,
          duration,
        });
        return Result.fail(deleteResult.error);
      }

      // Emit domain event
      const event = new BudgetLineDeletedEvent(
        command.id,
        budgetLine.budgetId,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'delete-budget-line.success',
        userId: command.userId,
        budgetLineId: command.id,
        budgetId: budgetLine.budgetId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'delete-budget-line.error',
        userId: command.userId,
        budgetLineId: command.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete budget line',
          'DELETE_BUDGET_LINE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
