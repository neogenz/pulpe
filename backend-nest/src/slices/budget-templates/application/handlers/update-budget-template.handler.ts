import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { UpdateBudgetTemplateCommand } from '../commands/update-budget-template.command';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';
import { TemplateInfo } from '../../domain/value-objects/template-info.value-object';
import { BudgetTemplateUpdatedEvent } from '../../domain/events/budget-template-updated.event';

@Injectable()
@CommandHandler(UpdateBudgetTemplateCommand)
export class UpdateBudgetTemplateHandler
  implements ICommandHandler<UpdateBudgetTemplateCommand>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateBudgetTemplateHandler.name);
  }

  async execute(
    command: UpdateBudgetTemplateCommand,
  ): Promise<Result<BudgetTemplate>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'update-budget-template.start',
      userId: command.userId,
      templateId: command.templateId,
    });

    try {
      // Find the existing template
      const findResult = await this.templateRepository.findById(
        command.templateId,
        command.userId,
      );
      if (findResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'update-budget-template.find-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: findResult.error.message,
          duration,
        });
        return Result.fail(findResult.error);
      }

      const existingTemplate = findResult.getValue();
      if (!existingTemplate) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'update-budget-template.not-found',
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

      // Create new template info
      const infoResult = TemplateInfo.create({
        name: command.name || existingTemplate.info.name,
        description:
          command.description !== undefined
            ? command.description
            : existingTemplate.info.description,
        isDefault:
          command.isDefault !== undefined
            ? command.isDefault
            : existingTemplate.info.isDefault,
      });

      if (infoResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'update-budget-template.invalid-info',
          userId: command.userId,
          templateId: command.templateId,
          error: infoResult.error.message,
          duration,
        });
        return Result.fail(infoResult.error);
      }

      // Update the template
      const updateResult = existingTemplate.updateInfo(infoResult.getValue());
      if (updateResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'update-budget-template.update-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: updateResult.error.message,
          duration,
        });
        return Result.fail(updateResult.error);
      }

      // If this template is being set as default, unset other defaults
      if (command.isDefault && !existingTemplate.info.isDefault) {
        const unsetResult = await this.templateRepository.setAsDefault(
          existingTemplate.id,
          command.userId,
        );
        if (unsetResult.isFailure) {
          this.logger.warn({
            operation: 'update-budget-template.unset-default-failed',
            userId: command.userId,
            error: unsetResult.error.message,
          });
          // Continue anyway, this is not critical
        }
      }

      // Save the updated template
      const saveResult = await this.templateRepository.save(existingTemplate);
      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'update-budget-template.save-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      const savedTemplate = saveResult.getValue();

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
        operation: 'update-budget-template.success',
        userId: command.userId,
        templateId: savedTemplate.id,
        duration,
      });

      return Result.ok(savedTemplate);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'update-budget-template.error',
        userId: command.userId,
        templateId: command.templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to update budget template',
          'UPDATE_TEMPLATE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
