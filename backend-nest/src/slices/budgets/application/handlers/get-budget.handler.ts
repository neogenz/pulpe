import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { GetBudgetQuery } from '../queries/get-budget.query';
import {
  BUDGET_REPOSITORY_TOKEN,
  type BudgetRepository,
} from '../../domain/repositories';
import { BudgetSnapshot } from '../../domain/entities/budget.entity';

@Injectable()
export class GetBudgetHandler {
  constructor(
    @Inject(BUDGET_REPOSITORY_TOKEN)
    private readonly repository: BudgetRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(query: GetBudgetQuery): Promise<Result<BudgetSnapshot>> {
    const context = {
      budgetId: query.budgetId,
      userId: query.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'GetBudget',
      context,
      logFn: async () => {
        try {
          // Find the budget
          const findResult = await this.repository.findById(
            query.budgetId,
            query.userId,
          );

          if (findResult.isFail()) {
            return Result.fail(findResult.error);
          }

          const budget = findResult.value;
          if (!budget) {
            return Result.fail(
              new GenericDomainException(
                'Budget not found',
                'BUDGET_NOT_FOUND',
                `Budget ${query.budgetId} not found or access denied`,
              ),
            );
          }

          this.logger.debug(
            {
              budgetId: budget.id,
              userId: budget.userId,
              period: budget.period.toString(),
            },
            'Budget retrieved successfully',
          );

          return Result.ok(budget.toSnapshot());
        } catch {
          this.logger.error({ error, context }, 'Failed to get budget');
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
