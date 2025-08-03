import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { DuplicateBudgetTemplateCommand } from '../commands/duplicate-budget-template.command';
import {
  BudgetTemplateRepository,
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-template.repository';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';
import { BudgetTemplateCreatedEvent } from '../../domain/events/budget-template-created.event';
import { BudgetTemplateDuplicatedEvent } from '../../domain/events/budget-template-duplicated.event';

@Injectable()
@CommandHandler(DuplicateBudgetTemplateCommand)
export class DuplicateBudgetTemplateHandler
  implements ICommandHandler<DuplicateBudgetTemplateCommand>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DuplicateBudgetTemplateHandler.name);
  }

  async execute(
    command: DuplicateBudgetTemplateCommand,
  ): Promise<Result<BudgetTemplate>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'duplicate-budget-template.start',
      userId: command.userId,
      templateId: command.templateId,
      newName: command.newName,
    });

    try {
      // Find the original template
      const findResult = await this.templateRepository.findById(
        command.templateId,
        command.userId,
      );
      if (findResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'duplicate-budget-template.find-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: findResult.error.message,
          duration,
        });
        return Result.fail(findResult.error);
      }

      const originalTemplate = findResult.getValue();
      if (!originalTemplate) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'duplicate-budget-template.not-found',
          userId: command.userId,
          templateId: command.templateId,
          duration,
        });
        return Result.fail(
          new GenericDomainException(
            'Template not found',
            'TEMPLATE_NOT_FOUND',
            `Template with ID ${command.templateId} not found`,
          ),
        );
      }

      // Duplicate the template
      const duplicateResult = originalTemplate.duplicate(command.newName);
      if (duplicateResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'duplicate-budget-template.duplicate-failed',
          userId: command.userId,
          templateId: command.templateId,
          error: duplicateResult.error.message,
          duration,
        });
        return Result.fail(duplicateResult.error);
      }

      const duplicatedTemplate = duplicateResult.getValue();

      // Save the duplicated template
      const saveResult =
        await this.templateRepository.saveWithLines(duplicatedTemplate);
      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'duplicate-budget-template.save-failed',
          userId: command.userId,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      const savedTemplate = saveResult.getValue();

      // Emit domain events
      const createdEvent = new BudgetTemplateCreatedEvent(
        savedTemplate.id,
        savedTemplate.userId,
        savedTemplate.info.name,
        savedTemplate.info.isDefault,
        savedTemplate.lines.length,
        new Date(),
      );
      this.eventBus.publish(createdEvent);

      const duplicatedEvent = new BudgetTemplateDuplicatedEvent(
        originalTemplate.id,
        savedTemplate.id,
        command.userId,
        savedTemplate.info.name,
        new Date(),
      );
      this.eventBus.publish(duplicatedEvent);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'duplicate-budget-template.success',
        userId: command.userId,
        originalTemplateId: originalTemplate.id,
        newTemplateId: savedTemplate.id,
        newName: savedTemplate.info.name,
        duration,
      });

      return Result.ok(savedTemplate);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'duplicate-budget-template.error',
        userId: command.userId,
        templateId: command.templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to duplicate budget template',
          'DUPLICATE_TEMPLATE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
