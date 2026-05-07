import { BudgetFormulas, type TransactionKind } from 'pulpe-shared';
import type { BudgetAggregates } from './budget.entity';

export type { BudgetAggregates };

export function calculateEndingBalanceFromMetrics(
  budgetLines: { id: string; kind: TransactionKind; amount: number }[],
  transactions: {
    kind: TransactionKind;
    amount: number;
    budgetLineId: string | null;
  }[],
): number {
  const metrics = BudgetFormulas.calculateAllMetrics(budgetLines, transactions);
  return metrics.endingBalance;
}

export function calculateRolloverFromBudgets(
  budgets: {
    id: string;
    month: number;
    year: number;
    endingBalance: number | null;
  }[],
  budgetId: string,
  payDayOfMonth: number,
): { rollover: number; previousBudgetId: string | null } {
  const result = BudgetFormulas.calculateRollover(
    budgets,
    budgetId,
    payDayOfMonth,
  );
  return {
    rollover: result.rollover,
    previousBudgetId: result.previousBudgetId,
  };
}

export function computeTargetMonths(
  startMonth: number,
  startYear: number,
  count: number,
): { month: number; year: number }[] {
  const MONTHS_PER_YEAR = 12;
  const targets: { month: number; year: number }[] = [];
  let month = startMonth;
  let year = startYear;

  for (let i = 0; i < count; i++) {
    targets.push({ month, year });
    month++;
    if (month > MONTHS_PER_YEAR) {
      month = 1;
      year++;
    }
  }
  return targets;
}

export function fieldsRequireAggregates(fields: string[]): boolean {
  return fields.some((f) =>
    ['totalExpenses', 'totalSavings', 'totalIncome', 'remaining'].includes(f),
  );
}

export function fieldsRequireRollover(fields: string[]): boolean {
  return fields.includes('rollover') || fields.includes('remaining');
}
