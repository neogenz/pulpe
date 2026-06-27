import { Inject, Injectable } from '@nestjs/common';
import { addMonths } from 'date-fns';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type { BudgetPeriodLookupPort } from '../domain/ports/budget-period-lookup.port';

@Injectable()
export class ResolveNextMonthBudgetUseCase implements BudgetPeriodLookupPort {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
  ) {}

  async findNextMonthBudgetId(
    sourceBudgetId: string,
    userId: string,
  ): Promise<string | null> {
    const source = await this.repo.fetchBudgetById(sourceBudgetId, userId);
    const nextPeriod = addMonths(
      new Date(Date.UTC(source.year, source.month - 1, 1)),
      1,
    );
    return this.repo.fetchBudgetIdByPeriod(
      nextPeriod.getUTCMonth() + 1,
      nextPeriod.getUTCFullYear(),
    );
  }
}
