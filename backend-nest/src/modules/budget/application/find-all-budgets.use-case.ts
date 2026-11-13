import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type ListBudgetsQuery, PAY_DAY_MIN } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { FindAllSparseBudgetsUseCase } from './find-all-sparse-budgets.use-case';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import { calculateRolloverFromBudgets } from '../domain/budget.formulas';
import type {
  Budget,
  BudgetWithRemaining,
  SparseBudgetItem,
} from '../domain/budget.entity';

type RolloverInput = {
  id: string;
  month: number;
  year: number;
  endingBalance: number;
};

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
    query?: ListBudgetsQuery,
  ): Promise<FindAllBudgetsResult> {
    const keyParts = [
      user.clientKey.toString('hex').slice(0, 16),
      query?.fields ?? '',
      query?.limit ?? '',
      query?.offset ?? 0,
      query?.year ?? '',
    ].join(':');
    const cacheKey = `budgets:list:${keyParts}`;
    return this.cacheService.getOrSet(user.id, cacheKey, 30_000, () =>
      this.fetchBudgetList(user, query),
    );
  }

  private async fetchBudgetList(
    user: AuthenticatedUser,
    query?: ListBudgetsQuery,
  ): Promise<FindAllBudgetsResult> {
    if (query?.fields) {
      const items = await this.findAllSparseUseCase.execute(user, query);
      return { kind: 'sparse', items };
    }

    const budgets = await this.repo.fetchAllBudgets();
    const payDayOfMonth = user.payDayOfMonth ?? PAY_DAY_MIN;

    const rolloverInputs: RolloverInput[] = budgets.map((b) => ({
      id: b.id,
      month: b.month,
      year: b.year,
      endingBalance: b.endingBalance ?? 0,
    }));

    const enrichedBudgets = await this.enrichBudgetsWithRemaining(
      budgets,
      payDayOfMonth,
      rolloverInputs,
    );

    return { kind: 'list', budgets: enrichedBudgets };
  }

  private async enrichBudgetsWithRemaining(
    budgets: Budget[],
    payDayOfMonth: number,
    rolloverInputs: RolloverInput[],
  ): Promise<BudgetWithRemaining[]> {
    return Promise.all(
      budgets.map(async (budget) => {
        const rolloverData = calculateRolloverFromBudgets(
          rolloverInputs,
          budget.id,
          payDayOfMonth,
        );
        try {
          const currentBalance =
            await this.recalculateUseCase.calculateEndingBalance(budget.id);
          return {
            ...budget,
            remaining: currentBalance + rolloverData.rollover,
          };
        } catch (error) {
          this.logger.warn(
            {
              budgetId: budget.id,
              month: budget.month,
              year: budget.year,
              err: error,
              operation: 'enrichBudgetsWithRemaining',
            },
            'Failed to calculate dynamic remaining, using stored ending_balance',
          );
          return {
            ...budget,
            remaining: (budget.endingBalance ?? 0) + rolloverData.rollover,
          };
        }
      }),
    );
  }
}
