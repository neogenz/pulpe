import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { CreateBudgetCommand } from '../commands/create-budget.command';
import {
  BUDGET_REPOSITORY_TOKEN,
  type BudgetRepository,
} from '../../domain/repositories';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { BudgetCreatedEvent } from '../../domain/events/budget-created.event';

export interface CreateBudgetResult {
  id: string;
  userId: string;
  month: number;
  year: number;
  description: string;
  templateId: string;
  budgetLinesCreated: number;
  createdAt: Date;
}

@Injectable()
export class CreateBudgetHandler {
  constructor(
    @Inject(BUDGET_REPOSITORY_TOKEN)
    private readonly repository: BudgetRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: CreateBudgetCommand,
  ): Promise<Result<CreateBudgetResult>> {
    const context = {
      userId: command.userId,
      month: command.month,
      year: command.year,
      templateId: command.templateId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'CreateBudget',
      context,
      logFn: async () => {
        try {
          // Create BudgetPeriod value object
          const periodResult = BudgetPeriod.create(command.month, command.year);
          if (periodResult.isFail()) {
            return Result.fail(periodResult.error);
          }
          const period = periodResult.value;

          // Check if budget already exists for this period
          const existsResult = await this.repository.existsForPeriod(
            period,
            command.userId,
          );
          if (existsResult.isFail()) {
            return Result.fail(existsResult.error);
          }

          if (existsResult.value) {
            return Result.fail(
              new GenericDomainException(
                'Budget already exists for this period',
                'BUDGET_ALREADY_EXISTS',
                `A budget for ${period.toString()} already exists`,
              ),
            );
          }

          // Create Budget entity
          const budgetResult = Budget.create({
            userId: command.userId,
            period,
            description: command.description,
            templateId: command.templateId,
          });

          if (budgetResult.isFail()) {
            return Result.fail(budgetResult.error);
          }
          const budget = budgetResult.value;

          // Create budget from template (atomic operation)
          const createResult = await this.repository.createFromTemplate(
            budget,
            command.templateId,
          );

          if (createResult.isFail()) {
            return Result.fail(createResult.error);
          }

          // Log success
          this.logger.info(
            {
              budgetId: budget.id,
              userId: command.userId,
              period: period.toString(),
              templateId: command.templateId,
              budgetLinesCreated: createResult.value.budgetLinesCreated,
            },
            'Budget created successfully from template',
          );

          // Publish domain event (could be handled by event bus in the future)
          const event = new BudgetCreatedEvent(
            budget.id,
            budget.userId,
            budget.templateId,
            period.month,
            period.year,
          );
          this.logger.debug({ event }, 'BudgetCreatedEvent published');

          return Result.ok<CreateBudgetResult>({
            id: budget.id,
            userId: budget.userId,
            month: period.month,
            year: period.year,
            description: budget.description,
            templateId: budget.templateId,
            budgetLinesCreated: createResult.value.budgetLinesCreated,
            createdAt: budget.createdAt,
          });
        } catch {
          this.logger.error({ error, context }, 'Failed to create budget');
          return Result.fail(
            error instanceof Error
              ? error
              : new Error('Unknown error occurred'),
          );
        }
      },
    });

    return operationResult;
  }
}
