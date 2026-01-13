/**
 * @fileoverview Budget Line Consumption Calculator
 *
 * Calculates how much of each budget line (envelope) has been consumed
 * by allocated transactions. Used for envelope-aware expense calculations.
 *
 * Business Rule (SPECS):
 * - Allocated transactions are "covered" by their envelope
 * - Only the OVERAGE (consumed > envelope.amount) impacts the budget
 * - Free transactions (no budgetLineId) impact the budget directly
 *
 * NOTE: Imports use .js extension (not .ts) - ESM Node.js requirement
 */

import type { TransactionKind } from '../types.js';

/**
 * Minimal interface for budget lines in consumption calculations
 */
interface BudgetLineForConsumption {
  id: string;
  kind: TransactionKind;
  amount: number;
}

/**
 * Minimal interface for transactions in consumption calculations
 */
interface TransactionForConsumption {
  kind: TransactionKind;
  amount: number;
  budgetLineId?: string | null;
}

/**
 * Represents the consumption state of a budget line
 */
export interface BudgetLineConsumption {
  budgetLine: BudgetLineForConsumption;
  consumed: number;
  remaining: number;
  allocatedTransactions: TransactionForConsumption[];
  transactionCount: number;
}

/**
 * Calculate consumption for a single budget line
 */
export function calculateBudgetLineConsumption(
  budgetLine: BudgetLineForConsumption,
  allTransactions: TransactionForConsumption[],
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
  budgetLines: BudgetLineForConsumption[],
  transactions: TransactionForConsumption[],
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
