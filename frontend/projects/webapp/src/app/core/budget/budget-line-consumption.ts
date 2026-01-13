/**
 * Budget Line Consumption Calculator
 *
 * Frontend-specific implementation for calculating envelope consumption.
 * Returns full objects for UI display (dialogs, tables).
 *
 * Business Rule (SPECS):
 * - Allocated transactions are "covered" by their envelope
 * - Only the OVERAGE (consumed > envelope.amount) impacts the budget
 * - Free transactions (no budgetLineId) impact the budget directly
 */
import type { BudgetLine, Transaction } from 'pulpe-shared';

/**
 * Represents the consumption state of a budget line.
 * Includes references to original objects for UI display.
 */
export interface BudgetLineConsumption {
  budgetLine: BudgetLine;
  consumed: number;
  remaining: number;
  allocatedTransactions: Transaction[];
  transactionCount: number;
}

/**
 * Calculate consumption for a single budget line.
 * Returns full objects for UI display (dialogs, tables).
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
 * Calculate consumption for all budget lines.
 * Returns a Map keyed by budget line ID for O(1) lookup.
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

// Alias for backwards compatibility
export const calculateAllEnrichedConsumptions = calculateAllConsumptions;
