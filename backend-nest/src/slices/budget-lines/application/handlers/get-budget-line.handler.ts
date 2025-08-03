import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { GetBudgetLineQuery } from '../queries/get-budget-line.query';
import {
  type BudgetLineRepository,
  BUDGET_LINE_REPOSITORY_TOKEN,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';

@Injectable()
@QueryHandler(GetBudgetLineQuery)
export class GetBudgetLineHandler implements IQueryHandler<GetBudgetLineQuery> {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY_TOKEN)
    private readonly budgetLineRepository: BudgetLineRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GetBudgetLineHandler.name);
  }

  async execute(query: GetBudgetLineQuery): Promise<Result<BudgetLine | null>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'get-budget-line.start',
      userId: query.userId,
      budgetLineId: query.id,
    });

    try {
      const result = await this.budgetLineRepository.findById(
        query.id,
        query.userId,
      );

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'get-budget-line.failed',
          userId: query.userId,
          budgetLineId: query.id,
          error: result.error.message,
          duration,
        });
        return result;
      }

      const budgetLine = result.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'get-budget-line.success',
        userId: query.userId,
        budgetLineId: query.id,
        found: budgetLine !== null,
        duration,
      });

      return Result.ok(budgetLine);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'get-budget-line.error',
        userId: query.userId,
        budgetLineId: query.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to get budget line',
          'GET_BUDGET_LINE_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
