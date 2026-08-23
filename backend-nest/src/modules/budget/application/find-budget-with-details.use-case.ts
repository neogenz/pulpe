import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  PAY_DAY_MIN,
  PAY_DAY_MAX,
  compareBudgetPeriods,
  getBudgetPeriodDates,
} from 'pulpe-shared';
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

  /** Read per request (singleton); tests override it. */
  now: () => Date = () => new Date();

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

    let historyMs = 0;
    const timedHistory = async () => {
      const start = performance.now();
      const result = await this.computeHistory(budget, payDayOfMonth);
      historyMs = performance.now() - start;
      return result;
    };

    const [rolloverData, history] = await Promise.all([
      this.recalculateUseCase.getRollover(budgetId, payDayOfMonth),
      timedHistory(),
    ]);

    this.logger.info(
      {
        budgetId,
        transactionCount: transactions.length,
        budgetLineCount: budgetLines.length,
        historyMs: Math.round(historyMs),
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

  /**
   * The budgets strictly before this one, newest first, reduced to a prior.
   * Skipped entirely off the current pay-day period — past budgets never show
   * a projection, so the query cost isn't worth paying. A broken history
   * query must not break the rest of the screen: on failure this logs and
   * returns null rather than throwing.
   *
   * All previous budgets (not just the newest 12) are handed to
   * `fetchHistoryData` — `driftHistory` slices to the newest 12 CLOSED months
   * after filtering, so an unchecked recent budget never evicts an older
   * closed one from the sample.
   */
  private async computeHistory(
    budget: Budget,
    payDayOfMonth: number,
  ): Promise<DriftHistory | null> {
    const { startDate, endDate } = getBudgetPeriodDates(
      budget.month,
      budget.year,
      payDayOfMonth,
    );
    const now = this.now();
    if (now < startDate || now > endDate) return null;
    if (budget.userId === null) return null;

    try {
      const previous = (
        await this.repo.fetchAllBudgetsForRollover(budget.userId)
      )
        .filter((b) => compareBudgetPeriods(b, budget) < 0)
        .sort((a, b) => compareBudgetPeriods(b, a));
      const months = await this.repo.fetchHistoryData(previous);
      return driftHistory(months, payDayOfMonth, now);
    } catch (error) {
      this.logger.warn(
        { budgetId: budget.id, err: error, operation: 'budget.history.failed' },
        'History fetch failed; details still return with history null',
      );
      return null;
    }
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
