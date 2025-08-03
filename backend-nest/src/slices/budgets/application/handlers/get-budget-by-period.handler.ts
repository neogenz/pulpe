import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { GetBudgetByPeriodQuery } from '../queries/get-budget-by-period.query';
import {
  BUDGET_REPOSITORY_TOKEN,
  type BudgetRepository,
} from '../../domain/repositories';
import { BudgetSnapshot } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';

@Injectable()
export class GetBudgetByPeriodHandler {
  constructor(
    @Inject(BUDGET_REPOSITORY_TOKEN)
    private readonly repository: BudgetRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    query: GetBudgetByPeriodQuery,
  ): Promise<Result<BudgetSnapshot | null>> {
    const context = {
      month: query.month,
      year: query.year,
      userId: query.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'GetBudgetByPeriod',
      context,
      logFn: async () => {
        try {
          // Create BudgetPeriod value object
          const periodResult = BudgetPeriod.create(query.month, query.year);
          if (periodResult.isFail()) {
            return Result.fail(periodResult.error);
          }
          const period = periodResult.value;

          // Find the budget for this period
          const findResult = await this.repository.findByPeriod(
            period,
            query.userId,
          );

          if (findResult.isFail()) {
            return Result.fail(findResult.error);
          }

          const budget = findResult.value;

          if (budget) {
            this.logger.debug(
              {
                budgetId: budget.id,
                userId: budget.userId,
                period: period.toString(),
              },
              'Budget found for period',
            );
            return Result.ok(budget.toSnapshot());
          } else {
            this.logger.debug(
              {
                userId: query.userId,
                period: period.toString(),
              },
              'No budget found for period',
            );
            return Result.ok(null);
          }
        } catch {
          this.logger.error(
            { error, context },
            'Failed to get budget by period',
          );
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
