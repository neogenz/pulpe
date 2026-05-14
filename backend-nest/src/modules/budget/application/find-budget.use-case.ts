import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type { Budget } from '../domain/budget.entity';

@Injectable()
export class FindBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @InjectInfoLogger(FindBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Budget> {
    const budget = await this.repo.fetchBudgetById(id, user.id);

    this.logger.info(
      { budgetId: id, userId: user.id, operation: 'budget.findOne' },
      'Budget fetched',
    );

    return budget;
  }
}
