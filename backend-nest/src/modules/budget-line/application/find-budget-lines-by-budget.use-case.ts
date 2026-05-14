import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type { BudgetLine } from '../domain/budget-line.entity';

@Injectable()
export class FindBudgetLinesByBudgetUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @InjectInfoLogger(FindBudgetLinesByBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetId: string,
    user: AuthenticatedUser,
  ): Promise<BudgetLine[]> {
    const entities = await this.repo.findByBudgetId(budgetId);

    this.logger.info(
      {
        userId: user.id,
        budgetId,
        count: entities.length,
        operation: 'budgetLine.findByBudget',
      },
      'Budget lines by budget fetched',
    );

    return entities;
  }
}
