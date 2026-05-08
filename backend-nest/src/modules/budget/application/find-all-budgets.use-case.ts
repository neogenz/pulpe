import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type ListBudgetsQuery, PAY_DAY_MIN, PAY_DAY_MAX } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { FindAllSparseBudgetsUseCase } from './find-all-sparse-budgets.use-case';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type {
  Budget,
  BudgetWithRemaining,
  SparseBudgetItem,
} from '../domain/budget.entity';

export type FindAllBudgetsResult =
  | { kind: 'list'; budgets: BudgetWithRemaining[] }
  | { kind: 'sparse'; items: SparseBudgetItem[] };

@Injectable()
export class FindAllBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly findAllSparseUseCase: FindAllSparseBudgetsUseCase,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(FindAllBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query?: ListBudgetsQuery,
  ): Promise<FindAllBudgetsResult> {
    const keyParts = [
      user.clientKey.toString('hex').slice(0, 16),
      query?.fields ?? '',
      query?.limit ?? '',
      query?.year ?? '',
    ].join(':');
    const cacheKey = `budgets:list:${keyParts}`;
    return this.cacheService.getOrSet(user.id, cacheKey, 30_000, () =>
      this.fetchBudgetList(user, supabase, query),
    );
  }

  private async fetchBudgetList(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query?: ListBudgetsQuery,
  ): Promise<FindAllBudgetsResult> {
    if (query?.fields) {
      const items = await this.findAllSparseUseCase.execute(
        user,
        supabase,
        query,
      );
      return { kind: 'sparse', items };
    }

    const budgets = await this.repo.fetchAllBudgets();
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);

    const enrichedBudgets = await this.enrichBudgetsWithRemaining(
      budgets,
      payDayOfMonth,
    );

    return { kind: 'list', budgets: enrichedBudgets };
  }

  private async enrichBudgetsWithRemaining(
    budgets: Budget[],
    payDayOfMonth: number,
  ): Promise<BudgetWithRemaining[]> {
    return Promise.all(
      budgets.map(async (budget) => {
        try {
          const remaining = await this.calculateRemainingForBudget(
            budget,
            payDayOfMonth,
          );
          return { ...budget, remaining };
        } catch (error) {
          this.logger.warn(
            {
              budgetId: budget.id,
              month: budget.month,
              year: budget.year,
              err: error,
              operation: 'enrichBudgetsWithRemaining',
            },
            'Failed to calculate remaining for budget, using fallback',
          );
          return { ...budget, remaining: budget.endingBalance ?? 0 };
        }
      }),
    );
  }

  private async calculateRemainingForBudget(
    budget: Budget,
    payDayOfMonth: number,
  ): Promise<number> {
    try {
      const currentBalance =
        await this.recalculateUseCase.calculateEndingBalance(budget.id);
      const rolloverData = await this.recalculateUseCase.getRollover(
        budget.id,
        payDayOfMonth,
      );
      return currentBalance + rolloverData.rollover;
    } catch (error) {
      this.logger.warn(
        {
          budgetId: budget.id,
          err: error,
          operation: 'calculateRemainingForBudget.fallback',
        },
        'Failed to calculate dynamic remaining, using stored ending_balance',
      );
      const rolloverData = await this.recalculateUseCase.getRollover(
        budget.id,
        payDayOfMonth,
      );
      return (budget.endingBalance ?? 0) + rolloverData.rollover;
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
