import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';

@Injectable()
export class HasBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @InjectInfoLogger(HasBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<boolean> {
    const result = await this.repo.hasAnyBudget();

    this.logger.info(
      { userId: user.id, hasBudgets: result, operation: 'budget.hasBudgets' },
      'Budget existence checked',
    );

    return result;
  }
}
