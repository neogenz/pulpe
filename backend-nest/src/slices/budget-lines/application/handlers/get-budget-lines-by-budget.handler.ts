import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { GetBudgetLinesByBudgetQuery } from '../queries/get-budget-lines-by-budget.query';
import {
  type BudgetLineRepository,
  BUDGET_LINE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';

@Injectable()
@QueryHandler(GetBudgetLinesByBudgetQuery)
export class GetBudgetLinesByBudgetHandler
  implements IQueryHandler<GetBudgetLinesByBudgetQuery>
{
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY_TOKEN)
    private readonly budgetLineRepository: BudgetLineRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GetBudgetLinesByBudgetHandler.name);
  }

  async execute(
    query: GetBudgetLinesByBudgetQuery,
  ): Promise<Result<BudgetLine[]>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'get-budget-lines-by-budget.start',
      userId: query.userId,
      budgetId: query.budgetId,
    });

    try {
      const result = await this.budgetLineRepository.findByBudgetId(
        query.budgetId,
        query.userId,
      );

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'get-budget-lines-by-budget.failed',
          userId: query.userId,
          budgetId: query.budgetId,
          error: result.error.message,
          duration,
        });
        return result;
      }

      const budgetLines = result.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'get-budget-lines-by-budget.success',
        userId: query.userId,
        budgetId: query.budgetId,
        count: budgetLines.length,
        duration,
      });

      return Result.ok(budgetLines);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'get-budget-lines-by-budget.error',
        userId: query.userId,
        budgetId: query.budgetId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to get budget lines by budget',
          'GET_BUDGET_LINES_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
