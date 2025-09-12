import type { BudgetLine, Transaction } from '@pulpe/shared';

/**
 * Maps a budget line to a transaction-like object for display purposes
 * This is a pure function that transforms budget lines into the transaction format
 * used by the UI components
 */
export function mapBudgetLineToFinancialEntry(
  budgetLine: BudgetLine,
  budgetId: string,
): Transaction & {
  rolloverSourceBudgetId?: string | null;
  isRollover: boolean; // Always defined, never optional
} {
  return {
    id: budgetLine.id,
    budgetId: budgetId,
    name: budgetLine.name,
    amount: budgetLine.amount,
    kind: budgetLine.kind,
    transactionDate: new Date().toISOString(),
    isOutOfBudget: false,
    category: null,
    createdAt: budgetLine.createdAt,
    updatedAt: budgetLine.updatedAt,
    rolloverSourceBudgetId:
      (budgetLine as unknown as { rolloverSourceBudgetId?: string | null })
        .rolloverSourceBudgetId ?? null,
    isRollover: budgetLine.isRollover ?? false, // Always defined with fallback
  };
}

/**
 * Maps multiple budget lines to financial entries for UI display
 */
export function mapBudgetLinesToFinancialEntries(
  budgetLines: BudgetLine[],
  budgetId: string,
): (Transaction & {
  rolloverSourceBudgetId?: string | null;
  isRollover: boolean;
})[] {
  return budgetLines.map((line) =>
    mapBudgetLineToFinancialEntry(line, budgetId),
  );
}

/**
 * Maps a transaction to a financial entry for UI display
 * Transactions are never rollovers, so isRollover is always false
 */
export function mapTransactionToFinancialEntry(
  transaction: Transaction,
): Transaction & { isRollover: boolean } {
  return {
    ...transaction,
    isRollover: false, // Transactions are never rollovers
  };
}
