import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { ListBudgetLinesQuery } from '../queries/list-budget-lines.query';
import {
  type BudgetLineRepository,
  BUDGET_LINE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';

@Injectable()
@QueryHandler(ListBudgetLinesQuery)
export class ListBudgetLinesHandler
  implements IQueryHandler<ListBudgetLinesQuery>
{
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY_TOKEN)
    private readonly budgetLineRepository: BudgetLineRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ListBudgetLinesHandler.name);
  }

  async execute(query: ListBudgetLinesQuery): Promise<Result<BudgetLine[]>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'list-budget-lines.start',
      userId: query.userId,
      filters: query.filters,
    });

    try {
      const result = await this.budgetLineRepository.findAll(
        query.userId,
        query.filters,
      );

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'list-budget-lines.failed',
          userId: query.userId,
          error: result.error.message,
          duration,
        });
        return result;
      }

      const budgetLines = result.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'list-budget-lines.success',
        userId: query.userId,
        count: budgetLines.length,
        duration,
      });

      return Result.ok(budgetLines);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'list-budget-lines.error',
        userId: query.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to list budget lines',
          'LIST_BUDGET_LINES_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
