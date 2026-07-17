import { Inject, Injectable } from '@nestjs/common';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type {
  BudgetPeriod,
  BudgetPeriodLookupPort,
} from '../domain/ports/budget-period-lookup.port';

const DECEMBER = 12;

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
    const target = await this.findNextMonthPeriod(sourceBudgetId, userId);
    return this.repo.fetchBudgetIdByPeriod(target.month, target.year);
  }

  async findNextMonthPeriod(
    sourceBudgetId: string,
    userId: string,
  ): Promise<BudgetPeriod> {
    const source = await this.repo.fetchBudgetById(sourceBudgetId, userId);
    // Pure month/year arithmetic — no Date math. `date-fns addMonths` on a
    // UTC-constructed Date applies LOCAL-time calendar rules, so on a non-UTC
    // (DST) host the read-back month could be off by one (e.g. March → March).
    return {
      month: source.month === DECEMBER ? 1 : source.month + 1,
      year: source.month === DECEMBER ? source.year + 1 : source.year,
    };
  }
}
