import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type { BudgetRecalculationPort } from '../domain/ports/budget-recalculation.port';
import {
  calculateEndingBalanceFromMetrics,
  calculateRolloverFromBudgets,
} from '../domain/budget.formulas';

@Injectable()
export class RecalculateBudgetBalancesUseCase implements BudgetRecalculationPort {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @InjectInfoLogger(RecalculateBudgetBalancesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async recalculate(budgetId: string, _clientKey: Buffer): Promise<void> {
    const endingBalance = await this.calculateEndingBalance(budgetId);
    await this.repo.persistEndingBalance(budgetId, endingBalance);

    this.logger.info(
      { budgetId, operation: 'balance.recalculated' },
      'Balance de fin de mois recalculée et persistée',
    );
  }

  async calculateEndingBalance(budgetId: string): Promise<number> {
    const { budgetLines, transactions } =
      await this.repo.fetchBudgetData(budgetId);

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

    return calculateEndingBalanceFromMetrics(linesForFormula, txsForFormula);
  }

  async getRollover(
    budgetId: string,
    payDayOfMonth: number,
  ): Promise<{ rollover: number; previousBudgetId: string | null }> {
    const userId = await this.repo.fetchBudgetUserId(budgetId);
    const allBudgets = await this.repo.fetchAllBudgetsForRollover(userId);

    if (!allBudgets.length) {
      return { rollover: 0, previousBudgetId: null };
    }

    const budgetsForFormula = allBudgets.map((b) => ({
      id: b.id,
      month: b.month,
      year: b.year,
      endingBalance: b.endingBalance ?? 0,
    }));

    return calculateRolloverFromBudgets(
      budgetsForFormula,
      budgetId,
      payDayOfMonth,
    );
  }
}
