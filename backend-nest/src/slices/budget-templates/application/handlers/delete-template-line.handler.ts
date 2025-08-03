import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { DeleteTemplateLineCommand } from '../commands/delete-template-line.command';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { BudgetTemplateUpdatedEvent } from '../../domain/events/budget-template-updated.event';

@Injectable()
@CommandHandler(DeleteTemplateLineCommand)
export class DeleteTemplateLineHandler
  implements ICommandHandler<DeleteTemplateLineCommand>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DeleteTemplateLineHandler.name);
  }

  async execute(command: DeleteTemplateLineCommand): Promise<Result<void>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'delete-template-line.start',
      userId: command.userId,
      templateId: command.templateId,
      lineId: command.lineId,
    });

    try {
      // Get template to verify it exists and check line count
      const templateResult = await this.templateRepository.findById(
        command.templateId,
        command.userId,
      );
      if (templateResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'delete-template-line.find-template-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: templateResult.error.message,
          duration,
        });
        return Result.fail(templateResult.error);
      }

      const template = templateResult.getValue();
      if (!template) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'delete-template-line.template-not-found',
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

      // Check if line exists
      const lineExists = template.lines.some(
        (line) => line.id === command.lineId,
      );
      if (!lineExists) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'delete-template-line.line-not-found',
          userId: command.userId,
          templateId: command.templateId,
          lineId: command.lineId,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Template line not found',
            'LINE_NOT_FOUND',
            `Line with ID ${command.lineId} not found in template`,
          ),
        );
      }

      // Ensure template has at least 2 lines before deletion
      if (template.lines.length <= 1) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'delete-template-line.cannot-delete-last-line',
          userId: command.userId,
          templateId: command.templateId,
          lineId: command.lineId,
          currentLineCount: template.lines.length,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Cannot delete last template line',
            'CANNOT_DELETE_LAST_LINE',
            'A template must have at least one line',
          ),
        );
      }

      // Delete the line
      const deleteResult = await this.templateRepository.deleteLine(
        command.templateId,
        command.lineId,
        command.userId,
      );

      if (deleteResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'delete-template-line.delete-failed',
          userId: command.userId,
          templateId: command.templateId,
          lineId: command.lineId,
          error: deleteResult.error.message,
          duration,
        });
        return Result.fail(deleteResult.error);
      }

      // Emit domain event
      const event = new BudgetTemplateUpdatedEvent(
        template.id,
        template.userId,
        template.info.name,
        template.info.isDefault,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'delete-template-line.success',
        userId: command.userId,
        templateId: command.templateId,
        lineId: command.lineId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'delete-template-line.error',
        userId: command.userId,
        templateId: command.templateId,
        lineId: command.lineId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete template line',
          'DELETE_LINE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
