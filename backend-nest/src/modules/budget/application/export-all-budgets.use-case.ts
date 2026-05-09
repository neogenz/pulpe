import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { PAY_DAY_MIN, PAY_DAY_MAX } from 'pulpe-shared';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  calculateEndingBalanceFromMetrics,
  calculateRolloverFromBudgets,
} from '../domain/budget.formulas';
import type { Budget, BudgetForExport } from '../domain/budget.entity';

@Injectable()
export class ExportAllBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
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

    const budgetsForRollover = budgets.map((b) => ({
      id: b.id,
      month: b.month,
      year: b.year,
      endingBalance: b.endingBalance ?? 0,
    }));

    const budgetsWithDetails = await Promise.all(
      budgets.map((budget) =>
        this.enrichBudgetForExport(budget, payDayOfMonth, budgetsForRollover),
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
    budgetsForRollover: {
      id: string;
      month: number;
      year: number;
      endingBalance: number;
    }[],
  ): Promise<BudgetForExport> {
    const { transactions, budgetLines } = await this.repo.fetchBudgetData(
      budget.id,
    );

    const rolloverData = calculateRolloverFromBudgets(
      budgetsForRollover,
      budget.id,
      payDayOfMonth,
    );

    const linesForFormula = budgetLines.map((bl) => ({
      id: bl.id,
      kind: bl.kind,
      amount: bl.amount,
    }));
    const txsForFormula = transactions.map((tx) => ({
      kind: tx.kind,
      amount: tx.amount,
      budgetLineId: tx.budgetLineId,
    }));
    const currentBalance = calculateEndingBalanceFromMetrics(
      linesForFormula,
      txsForFormula,
    );
    const remaining = currentBalance + rolloverData.rollover;

    return {
      budget,
      budgetLines,
      transactions,
      rollover: rolloverData.rollover,
      previousBudgetId: rolloverData.previousBudgetId,
      remaining,
    };
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
