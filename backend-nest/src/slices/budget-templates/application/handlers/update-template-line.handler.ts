import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { UpdateTemplateLineCommand } from '../commands/update-template-line.command';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';
import { BudgetTemplateUpdatedEvent } from '../../domain/events/budget-template-updated.event';

@Injectable()
@CommandHandler(UpdateTemplateLineCommand)
export class UpdateTemplateLineHandler
  implements ICommandHandler<UpdateTemplateLineCommand>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateTemplateLineHandler.name);
  }

  async execute(
    command: UpdateTemplateLineCommand,
  ): Promise<Result<TemplateLine>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'update-template-line.start',
      userId: command.userId,
      templateId: command.templateId,
      lineId: command.lineId,
    });

    try {
      // Get template to verify it exists and get current lines
      const templateResult = await this.templateRepository.findById(
        command.templateId,
        command.userId,
      );
      if (templateResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'update-template-line.find-template-failed',
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
          operation: 'update-template-line.template-not-found',
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

      // Find the line to update
      const existingLine = template.lines.find(
        (line) => line.id === command.lineId,
      );
      if (!existingLine) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'update-template-line.line-not-found',
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

      // Prepare update data
      const updateData: Partial<{
        name: string;
        amount: number;
        kind: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE';
        recurrence: 'fixed' | 'estimated';
        description: string | null;
      }> = {};

      if (command.name !== undefined) updateData.name = command.name;
      if (command.amount !== undefined) updateData.amount = command.amount;
      if (command.kind !== undefined) updateData.kind = command.kind;
      if (command.recurrence !== undefined)
        updateData.recurrence = command.recurrence;
      if (command.description !== undefined)
        updateData.description = command.description;

      // Update the line in the template
      const updateResult = template.updateLine(command.lineId, updateData);
      if (updateResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'update-template-line.update-failed',
          userId: command.userId,
          templateId: command.templateId,
          lineId: command.lineId,
          error: updateResult.error.message,
          duration,
        });
        return Result.fail(updateResult.error);
      }

      // Save the updated template with lines
      const saveResult = await this.templateRepository.saveWithLines(template);
      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'update-template-line.save-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      // Find the updated line in the saved template
      const savedTemplate = saveResult.getValue();
      const savedLine = savedTemplate.lines.find(
        (line) => line.id === command.lineId,
      );
      if (!savedLine) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'update-template-line.line-not-found-after-save',
          userId: command.userId,
          templateId: command.templateId,
          lineId: command.lineId,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Failed to retrieve updated line',
            'LINE_RETRIEVAL_ERROR',
            'Updated line not found after save',
          ),
        );
      }

      // Emit domain event
      const event = new BudgetTemplateUpdatedEvent(
        savedTemplate.id,
        savedTemplate.userId,
        savedTemplate.info.name,
        savedTemplate.info.isDefault,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'update-template-line.success',
        userId: command.userId,
        templateId: command.templateId,
        lineId: command.lineId,
        duration,
      });

      return Result.ok(savedLine);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'update-template-line.error',
        userId: command.userId,
        templateId: command.templateId,
        lineId: command.lineId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to update template line',
          'UPDATE_LINE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
