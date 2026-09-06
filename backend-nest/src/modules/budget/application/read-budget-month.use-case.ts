import { Inject, Injectable } from '@nestjs/common';
import { BudgetFormulas } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type {
  BudgetMonthReadPort,
  BudgetMonthSummary,
} from '../domain/ports/budget-month-read.port';
import type {
  BudgetWithDetails,
  SparseBudgetItem,
} from '../domain/budget.entity';
import { FindBudgetWithDetailsUseCase } from './find-budget-with-details.use-case';
import { FindAllSparseBudgetsUseCase } from './find-all-sparse-budgets.use-case';

/** Every total the list serves; the sparse read only computes what is asked. */
const SUMMARY_FIELDS =
  'month,year,totalIncome,totalExpenses,totalSavings,rollover,remaining';

/** Period → budget, for in-process consumers that have no HTTP params. */
@Injectable()
export class ReadBudgetMonthUseCase implements BudgetMonthReadPort {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly findWithDetails: FindBudgetWithDetailsUseCase,
    private readonly findAllSparse: FindAllSparseBudgetsUseCase,
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

  async listMonths(limit: number): Promise<BudgetMonthSummary[]> {
    const items = await this.findAllSparse.execute(
      this.session.user,
      this.session.client,
      { fields: SUMMARY_FIELDS, limit },
    );
    return items.map((item) => this.#toSummary(item));
  }

  // Same two formulas as the sparse HTTP mapper, so a month reads identically
  // whether it reaches the user through the app or through an agent.
  #toSummary(item: SparseBudgetItem): BudgetMonthSummary {
    const totals = item.aggregates ?? {
      totalIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
    };
    const rollover = item.rollover ?? 0;
    const available = BudgetFormulas.calculateAvailable(
      totals.totalIncome,
      rollover,
    );
    return {
      id: item.budget.id,
      month: item.budget.month,
      year: item.budget.year,
      totalIncome: totals.totalIncome,
      totalExpenses: totals.totalExpenses,
      totalSavings: totals.totalSavings,
      rollover,
      remaining: BudgetFormulas.calculateRemaining(
        available,
        totals.totalExpenses,
      ),
    };
  }
}
