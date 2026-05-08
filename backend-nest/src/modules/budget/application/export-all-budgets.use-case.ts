import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { PAY_DAY_MIN, PAY_DAY_MAX } from 'pulpe-shared';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type { Budget, BudgetForExport } from '../domain/budget.entity';

@Injectable()
export class ExportAllBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(ExportAllBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetForExport[]> {
    const startTime = Date.now();
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);
    const budgets = await this.repo.fetchAllBudgetsForExport();
    const budgetsWithDetails = await Promise.all(
      budgets.map((budget) =>
        this.enrichBudgetForExport(budget, payDayOfMonth),
      ),
    );

    this.logger.info(
      {
        userId: user.id,
        budgetCount: budgetsWithDetails.length,
        duration: Date.now() - startTime,
        operation: 'budget.export.success',
      },
      'All budgets exported successfully',
    );

    return budgetsWithDetails;
  }

  private async enrichBudgetForExport(
    budget: Budget,
    payDayOfMonth: number,
  ): Promise<BudgetForExport> {
    const { transactions, budgetLines } = await this.repo.fetchBudgetData(
      budget.id,
    );

    const rolloverData = await this.recalculateUseCase.getRollover(
      budget.id,
      payDayOfMonth,
    );

    const remaining = await this.calculateRemainingForBudget(
      budget,
      payDayOfMonth,
    );

    return {
      budget,
      budgetLines,
      transactions,
      rollover: rolloverData.rollover,
      previousBudgetId: rolloverData.previousBudgetId,
      remaining,
    };
  }

  private async calculateRemainingForBudget(
    budget: Budget,
    payDayOfMonth: number,
  ): Promise<number> {
    const currentBalance = await this.recalculateUseCase.calculateEndingBalance(
      budget.id,
    );
    const rolloverData = await this.recalculateUseCase.getRollover(
      budget.id,
      payDayOfMonth,
    );
    return currentBalance + rolloverData.rollover;
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
