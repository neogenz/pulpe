import type { BudgetLine, Transaction } from "pulpe-shared";

const PERCENT = 100;

export interface LineConsumption {
  allocated: number;
  available: number;
  percentage: number;
}

/**
 * What an envelope has absorbed so far. Port of
 * `BudgetFormulas.calculateConsumption` (Swift) — it drives a progress bar, the
 * drift filter and the budget-detail rows, never a stored amount, which is why
 * it lives here rather than in `shared/src/calculators/`.
 */
export function lineConsumption(
  line: BudgetLine,
  transactions: Transaction[],
): LineConsumption {
  const allocated = transactions
    .filter((transaction) => transaction.budgetLineId === line.id)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    allocated,
    available: line.amount - allocated,
    percentage: line.amount > 0 ? (allocated / line.amount) * PERCENT : 0,
  };
}
