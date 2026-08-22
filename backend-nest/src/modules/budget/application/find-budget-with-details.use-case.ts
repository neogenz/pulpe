import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { PAY_DAY_MIN, PAY_DAY_MAX, compareBudgetPeriods } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type { Budget, BudgetWithDetails } from '../domain/budget.entity';
import { driftHistory, type DriftHistory } from '../domain/drift-history';

@Injectable()
export class FindBudgetWithDetailsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(FindBudgetWithDetailsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetWithDetails> {
    const clientKeyHash = user.clientKey.toString('hex').slice(0, 16);
    const cacheKey = `budgets:detail:${clientKeyHash}:${budgetId}`;
    return this.cacheService.getOrSet(user.id, cacheKey, 30_000, () =>
      this.fetchBudgetWithDetails(budgetId, supabase),
    );
  }

  private async fetchBudgetWithDetails(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetWithDetails> {
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);
    const { budget, budgetLines, transactions } =
      await this.repo.fetchBudgetData(budgetId);

    const [rolloverData, history] = await Promise.all([
      this.recalculateUseCase.getRollover(budgetId, payDayOfMonth),
      this.computeHistory(budget, payDayOfMonth),
    ]);

    this.logger.info(
      {
        budgetId,
        transactionCount: transactions.length,
        budgetLineCount: budgetLines.length,
        operation: 'budget.details.fetched',
      },
      'Budget details fetched successfully',
    );

    return {
      budget,
      budgetLines,
      transactions,
      rollover: rolloverData.rollover,
      previousBudgetId: rolloverData.previousBudgetId,
      history,
    };
  }

  /** The ≤12 budgets strictly before this one, newest first, reduced to a prior. */
  private async computeHistory(
    budget: Budget,
    payDayOfMonth: number,
  ): Promise<DriftHistory | null> {
    const previous = (await this.repo.fetchAllBudgets())
      .filter((b) => compareBudgetPeriods(b, budget) < 0)
      .sort((a, b) => compareBudgetPeriods(b, a))
      .slice(0, 12);
    const months = await this.repo.fetchHistoryData(previous);
    return driftHistory(months, payDayOfMonth);
  }

  private async getPayDayOfMonth(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { data } = await supabase.auth.getUser();
    const raw = data?.user?.user_metadata?.payDayOfMonth;

    if (typeof raw !== 'number' || !Number.isInteger(raw)) return PAY_DAY_MIN;

    return Math.max(PAY_DAY_MIN, Math.min(PAY_DAY_MAX, raw));
  }
}
