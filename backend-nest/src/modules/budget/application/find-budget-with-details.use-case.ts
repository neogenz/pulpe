import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type BudgetDetailsResponse,
  PAY_DAY_MIN,
  PAY_DAY_MAX,
} from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';

@Injectable()
export class FindBudgetWithDetailsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly mapper: BudgetMapper,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(FindBudgetWithDetailsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    const clientKeyHash = user.clientKey.toString('hex').slice(0, 16);
    const cacheKey = `budgets:detail:${clientKeyHash}:${budgetId}`;
    return this.cacheService.getOrSet(user.id, cacheKey, 30_000, () =>
      this.fetchBudgetWithDetails(budgetId, supabase),
    );
  }

  private async fetchBudgetWithDetails(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);
    const { budget, budgetLines, transactions } =
      await this.repo.fetchBudgetData(budgetId);

    const rolloverData = await this.recalculateUseCase.getRollover(
      budgetId,
      payDayOfMonth,
    );

    const responseData = {
      budget: {
        ...this.mapper.toApi(budget),
        rollover: rolloverData.rollover,
        previousBudgetId: rolloverData.previousBudgetId,
      },
      transactions: this.mapper.toTransactionApiList(transactions),
      budgetLines: this.mapper.toBudgetLineApiList(budgetLines),
    };

    this.logger.info(
      {
        budgetId,
        transactionCount: responseData.transactions.length,
        budgetLineCount: responseData.budgetLines.length,
        operation: 'budget.details.fetched',
      },
      'Budget details fetched successfully',
    );

    return { success: true, data: responseData } as BudgetDetailsResponse;
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
