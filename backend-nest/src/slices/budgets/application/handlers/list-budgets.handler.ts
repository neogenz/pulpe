import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { ListBudgetsQuery } from '../queries/list-budgets.query';
import {
  BUDGET_REPOSITORY_TOKEN,
  type BudgetRepository,
} from '../../domain/repositories';
import { BudgetSnapshot } from '../../domain/entities/budget.entity';

@Injectable()
export class ListBudgetsHandler {
  constructor(
    @Inject(BUDGET_REPOSITORY_TOKEN)
    private readonly repository: BudgetRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(query: ListBudgetsQuery): Promise<Result<BudgetSnapshot[]>> {
    const context = {
      userId: query.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'ListBudgets',
      context,
      logFn: async () => {
        try {
          // Find all budgets for the user
          const findResult = await this.repository.findByUserId(query.userId);

          if (findResult.isFail()) {
            return Result.fail(findResult.error);
          }

          const budgets = findResult.value;

          // Convert to snapshots and sort by year and month descending
          const snapshots = budgets
            .map((budget) => budget.toSnapshot())
            .sort((a, b) => {
              // First sort by year descending
              if (a.year !== b.year) {
                return b.year - a.year;
              }
              // Then by month descending
              return b.month - a.month;
            });

          this.logger.info(
            {
              userId: query.userId,
              budgetCount: snapshots.length,
            },
            'Budgets listed successfully',
          );

          return Result.ok(snapshots);
        } catch {
          this.logger.error({ error, context }, 'Failed to list budgets');
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
