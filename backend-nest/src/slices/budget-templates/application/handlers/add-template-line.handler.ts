import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { AddTemplateLineCommand } from '../commands/add-template-line.command';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';
import { BudgetTemplateUpdatedEvent } from '../../domain/events/budget-template-updated.event';

@Injectable()
@CommandHandler(AddTemplateLineCommand)
export class AddTemplateLineHandler
  implements ICommandHandler<AddTemplateLineCommand>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AddTemplateLineHandler.name);
  }

  async execute(
    command: AddTemplateLineCommand,
  ): Promise<Result<TemplateLine>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'add-template-line.start',
      userId: command.userId,
      templateId: command.templateId,
      lineName: command.name,
    });

    try {
      // Verify template exists
      const existsResult = await this.templateRepository.exists(
        command.templateId,
        command.userId,
      );
      if (existsResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'add-template-line.exists-check-failed',
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
          operation: 'add-template-line.template-not-found',
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

      // Create the new template line
      const lineResult = TemplateLine.create({
        name: command.name,
        amount: command.amount,
        kind: command.kind,
        recurrence: command.recurrence,
        description: command.description,
      });

      if (lineResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'add-template-line.invalid-line',
          userId: command.userId,
          templateId: command.templateId,
          lineName: command.name,
          error: lineResult.error.message,
          duration,
        });
        return Result.fail(lineResult.error);
      }

      const line = lineResult.getValue();

      // Save the line
      const saveResult = await this.templateRepository.saveLines(
        command.templateId,
        [line],
        command.userId,
      );

      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'add-template-line.save-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      const savedLines = saveResult.getValue();
      if (savedLines.length === 0) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'add-template-line.no-line-saved',
          userId: command.userId,
          templateId: command.templateId,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Failed to save template line',
            'SAVE_LINE_ERROR',
            'No line was saved',
          ),
        );
      }

      // Emit domain event for template update
      const templateResult = await this.templateRepository.findById(
        command.templateId,
        command.userId,
      );
      if (templateResult.isSuccess && templateResult.getValue()) {
        const template = templateResult.getValue()!;
        const event = new BudgetTemplateUpdatedEvent(
          template.id,
          template.userId,
          template.info.name,
          template.info.isDefault,
          new Date(),
        );
        this.eventBus.publish(event);
      }

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'add-template-line.success',
        userId: command.userId,
        templateId: command.templateId,
        lineId: savedLines[0].id,
        duration,
      });

      return Result.ok(savedLines[0]);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'add-template-line.error',
        userId: command.userId,
        templateId: command.templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to add template line',
          'ADD_LINE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
