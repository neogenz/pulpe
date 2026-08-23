import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type { BudgetMonthReadPort } from '../domain/ports/budget-month-read.port';
import type { BudgetWithDetails } from '../domain/budget.entity';
import { FindBudgetWithDetailsUseCase } from './find-budget-with-details.use-case';

/** Period → budget, for in-process consumers that have no HTTP params. */
@Injectable()
export class ReadBudgetMonthUseCase implements BudgetMonthReadPort {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly findWithDetails: FindBudgetWithDetailsUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  async readMonth(
    month: number,
    year: number,
  ): Promise<BudgetWithDetails | null> {
    const budgetId = await this.repo.fetchBudgetIdByPeriod(month, year);
    if (!budgetId) return null;
    return this.findWithDetails.execute(
      budgetId,
      this.session.user,
      this.session.client,
    );
  }
}
