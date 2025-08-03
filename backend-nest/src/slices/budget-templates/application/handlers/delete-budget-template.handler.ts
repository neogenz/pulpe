import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { DeleteBudgetTemplateCommand } from '../commands/delete-budget-template.command';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { BudgetTemplateDeletedEvent } from '../../domain/events/budget-template-deleted.event';

@Injectable()
@CommandHandler(DeleteBudgetTemplateCommand)
export class DeleteBudgetTemplateHandler
  implements ICommandHandler<DeleteBudgetTemplateCommand>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DeleteBudgetTemplateHandler.name);
  }

  async execute(command: DeleteBudgetTemplateCommand): Promise<Result<void>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'delete-budget-template.start',
      userId: command.userId,
      templateId: command.templateId,
    });

    try {
      // Check if template exists
      const existsResult = await this.templateRepository.exists(
        command.templateId,
        command.userId,
      );
      if (existsResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'delete-budget-template.exists-check-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: existsResult.error.message,
          duration,
        });
        return Result.fail(existsResult.error);
      }

      if (!existsResult.getValue()) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'delete-budget-template.not-found',
          userId: command.userId,
          templateId: command.templateId,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Budget template not found',
            'TEMPLATE_NOT_FOUND',
            `Template with ID ${command.templateId} not found`,
          ),
        );
      }

      // Check if it's the default template
      const defaultTemplateResult =
        await this.templateRepository.findDefaultByUserId(command.userId);
      if (defaultTemplateResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'delete-budget-template.default-check-failed',
          userId: command.userId,
          error: defaultTemplateResult.error.message,
          duration,
        });
        return Result.fail(defaultTemplateResult.error);
      }

      const defaultTemplate = defaultTemplateResult.getValue();
      if (defaultTemplate && defaultTemplate.id === command.templateId) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'delete-budget-template.cannot-delete-default',
          userId: command.userId,
          templateId: command.templateId,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Cannot delete default template',
            'CANNOT_DELETE_DEFAULT_TEMPLATE',
            'The default template cannot be deleted. Please set another template as default first.',
          ),
        );
      }

      // Delete the template (cascade deletes lines due to foreign key)
      const deleteResult = await this.templateRepository.delete(
        command.templateId,
        command.userId,
      );
      if (deleteResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'delete-budget-template.delete-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: deleteResult.error.message,
          duration,
        });
        return Result.fail(deleteResult.error);
      }

      // Emit domain event
      const event = new BudgetTemplateDeletedEvent(
        command.templateId,
        command.userId,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'delete-budget-template.success',
        userId: command.userId,
        templateId: command.templateId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'delete-budget-template.error',
        userId: command.userId,
        templateId: command.templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete budget template',
          'DELETE_TEMPLATE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
