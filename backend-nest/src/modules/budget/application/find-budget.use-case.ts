import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type BudgetResponse } from 'pulpe-shared';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';

@Injectable()
export class FindBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly mapper: BudgetMapper,
    @InjectInfoLogger(FindBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<BudgetResponse> {
    const budget = await this.repo.fetchBudgetById(id, user.id);

    this.logger.info(
      { budgetId: id, userId: user.id, operation: 'budget.findOne' },
      'Budget fetched',
    );

    return {
      success: true,
      data: this.mapper.toApi(budget as Parameters<BudgetMapper['toApi']>[0]),
    };
  }
}
