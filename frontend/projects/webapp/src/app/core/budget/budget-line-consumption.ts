import type { BudgetLine, Transaction } from '@pulpe/shared';

/**
 * Represents the consumption state of a budget line
 */
export interface BudgetLineConsumption {
  /** The budget line */
  budgetLine: BudgetLine;
  /** Total amount consumed (sum of allocated transactions) */
  consumed: number;
  /** Amount remaining (budgetLine.amount - consumed). Can be negative if overspent */
  remaining: number;
  /** Transactions allocated to this budget line */
  allocatedTransactions: Transaction[];
  /** Number of allocated transactions */
  transactionCount: number;
}

/**
 * Calculate consumption for a single budget line
 */
export function calculateBudgetLineConsumption(
  budgetLine: BudgetLine,
  allTransactions: Transaction[],
): BudgetLineConsumption {
  const allocatedTransactions = allTransactions.filter(
    (tx) => tx.budgetLineId === budgetLine.id,
  );

  const consumed = allocatedTransactions.reduce(
    (sum, tx) => sum + tx.amount,
    0,
  );

  const remaining = budgetLine.amount - consumed;

  return {
    budgetLine,
    consumed,
    remaining,
    allocatedTransactions,
    transactionCount: allocatedTransactions.length,
  };
}

/**
 * Calculate consumption for all budget lines
 * Returns a Map keyed by budget line ID for O(1) lookup
 */
export function calculateAllConsumptions(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
): Map<string, BudgetLineConsumption> {
  const consumptionMap = new Map<string, BudgetLineConsumption>();

  budgetLines.forEach((line) => {
    // Skip virtual rollover lines
    if (line.id.startsWith('rollover-')) return;

    const consumption = calculateBudgetLineConsumption(line, transactions);
    consumptionMap.set(line.id, consumption);
  });

  return consumptionMap;
}
