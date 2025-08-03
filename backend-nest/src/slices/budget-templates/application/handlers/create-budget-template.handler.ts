import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { CreateBudgetTemplateCommand } from '../commands/create-budget-template.command';
import {
  BUDGET_TEMPLATE_REPOSITORY_TOKEN,
  type BudgetTemplateRepository,
} from '../../domain/repositories/budget-template.repository';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';
import { TemplateInfo } from '../../domain/value-objects/template-info.value-object';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';
import { BudgetTemplateCreatedEvent } from '../../domain/events/budget-template-created.event';

@Injectable()
@CommandHandler(CreateBudgetTemplateCommand)
export class CreateBudgetTemplateHandler
  implements ICommandHandler<CreateBudgetTemplateCommand>
{
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepository: BudgetTemplateRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateBudgetTemplateHandler.name);
  }

  async execute(
    command: CreateBudgetTemplateCommand,
  ): Promise<Result<BudgetTemplate>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'create-budget-template.start',
      userId: command.userId,
      name: command.name,
      linesCount: command.lines?.length || 0,
    });

    try {
      // Create template info
      const infoResult = TemplateInfo.create({
        name: command.name,
        description: command.description,
        isDefault: command.isDefault || false,
      });

      if (infoResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'create-budget-template.invalid-info',
          userId: command.userId,
          error: infoResult.error.message,
          duration,
        });
        return Result.fail(infoResult.error);
      }

      // Create template lines
      const lines: TemplateLine[] = [];
      if (command.lines && command.lines.length > 0) {
        for (const lineData of command.lines) {
          const lineResult = TemplateLine.create({
            name: lineData.name,
            amount: lineData.amount,
            kind: lineData.kind,
            recurrence: lineData.recurrence,
            description: lineData.description,
          });

          if (lineResult.isFailure) {
            const duration = performance.now() - startTime;
            this.logger.warn({
              operation: 'create-budget-template.invalid-line',
              userId: command.userId,
              lineName: lineData.name,
              error: lineResult.error.message,
              duration,
            });
            return Result.fail(lineResult.error);
          }

          lines.push(lineResult.getValue());
        }
      } else {
        // If no lines provided, create a default income line
        const defaultIncomeResult = TemplateLine.create({
          name: 'Monthly Income',
          amount: 0,
          kind: 'INCOME',
          recurrence: 'fixed',
          description: 'Default income line',
        });

        if (defaultIncomeResult.isSuccess) {
          lines.push(defaultIncomeResult.getValue());
        }
      }

      // Create template entity
      const templateResult = BudgetTemplate.create({
        userId: command.userId,
        info: infoResult.getValue(),
        lines,
      });

      if (templateResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'create-budget-template.invalid-entity',
          userId: command.userId,
          error: templateResult.error.message,
          duration,
        });
        return Result.fail(templateResult.error);
      }

      const template = templateResult.getValue();

      // If this is the default template, unset other defaults
      if (command.isDefault) {
        const unsetResult = await this.templateRepository.setAsDefault(
          template.id,
          command.userId,
        );
        if (unsetResult.isFailure) {
          this.logger.warn({
            operation: 'create-budget-template.unset-default-failed',
            userId: command.userId,
            error: unsetResult.error.message,
          });
          // Continue anyway, this is not critical
        }
      }

      // Save template with lines
      const saveResult = await this.templateRepository.saveWithLines(template);
      if (saveResult.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.error({
          operation: 'create-budget-template.save-failed',
          userId: command.userId,
          error: saveResult.error.message,
          duration,
        });
        return Result.fail(saveResult.error);
      }

      const savedTemplate = saveResult.getValue();

      // Emit domain event
      const event = new BudgetTemplateCreatedEvent(
        savedTemplate.id,
        savedTemplate.userId,
        savedTemplate.info.name,
        savedTemplate.info.isDefault,
        savedTemplate.lines.length,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'create-budget-template.success',
        userId: command.userId,
        templateId: savedTemplate.id,
        linesCount: savedTemplate.lines.length,
        duration,
      });

      return Result.ok(savedTemplate);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'create-budget-template.error',
        userId: command.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to create budget template',
          'CREATE_TEMPLATE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
