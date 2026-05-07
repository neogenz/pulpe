import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type BudgetListResponse,
  type BudgetSparseListResponse,
  type ListBudgetsQuery,
  PAY_DAY_MIN,
  PAY_DAY_MAX,
} from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  BudgetMapper,
  type EnrichedBudgetRow,
} from '../infrastructure/mappers/budget.mapper';
import { FindAllSparseBudgetsUseCase } from './find-all-sparse-budgets.use-case';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type { BudgetRow } from '../domain/budget.entity';

@Injectable()
export class FindAllBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly cacheService: CacheService,
    private readonly mapper: BudgetMapper,
    private readonly findAllSparseUseCase: FindAllSparseBudgetsUseCase,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(FindAllBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query?: ListBudgetsQuery,
  ): Promise<BudgetListResponse | BudgetSparseListResponse> {
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
  ): Promise<BudgetListResponse | BudgetSparseListResponse> {
    if (query?.fields) {
      return this.findAllSparseUseCase.execute(user, supabase, query);
    }

    const budgets = await this.repo.fetchAllBudgets();
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);

    const enrichedBudgets = await this.enrichBudgetsWithRemaining(
      budgets,
      supabase,
      payDayOfMonth,
      user.clientKey,
    );

    return {
      success: true as const,
      data: this.mapper.toApiList(enrichedBudgets),
    } as BudgetListResponse;
  }

  private async enrichBudgetsWithRemaining(
    budgets: BudgetRow[],
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<EnrichedBudgetRow[]> {
    return Promise.all(
      budgets.map(async (budget) => {
        try {
          const remaining = await this.calculateRemainingForBudget(
            budget,
            supabase,
            payDayOfMonth,
            clientKey,
          );
          const decryptedBalance = await this.decryptEndingBalance(
            budget,
            clientKey,
          );
          return { ...budget, ending_balance: decryptedBalance, remaining };
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
          const fallbackBalance = await this.decryptEndingBalance(
            budget,
            clientKey,
          );
          return {
            ...budget,
            ending_balance: fallbackBalance,
            remaining: fallbackBalance,
          };
        }
      }),
    );
  }

  private async calculateRemainingForBudget(
    budget: BudgetRow,
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<number> {
    try {
      const currentBalance =
        await this.recalculateUseCase.calculateEndingBalance(
          budget.id,
          supabase,
          clientKey,
        );
      const rolloverData = await this.recalculateUseCase.getRollover(
        budget.id,
        payDayOfMonth,
        supabase,
        clientKey,
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
        supabase,
        clientKey,
      );
      const endingBalanceStored = await this.decryptEndingBalance(
        budget,
        clientKey,
      );
      return endingBalanceStored + rolloverData.rollover;
    }
  }

  private async decryptEndingBalance(
    budget: BudgetRow,
    clientKey: Buffer,
  ): Promise<number> {
    if (!budget.ending_balance) return 0;
    const dek = await this.encryption.getUserDEK(budget.user_id!, clientKey);
    return this.encryption.tryDecryptAmount(budget.ending_balance, dek, 0);
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
