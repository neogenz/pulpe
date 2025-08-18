import type { BudgetLine, Transaction } from '@pulpe/shared';

/**
 * Maps a budget line to a transaction-like object for display purposes
 * This is a pure function that transforms budget lines into the transaction format
 * used by the UI components
 */
export function mapBudgetLineToTransaction(
  budgetLine: BudgetLine,
  budgetId: string,
): Transaction {
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
  };
}

/**
 * Maps multiple budget lines to transactions
 */
export function mapBudgetLinesToTransactions(
  budgetLines: BudgetLine[],
  budgetId: string,
): Transaction[] {
  return budgetLines.map((line) => mapBudgetLineToTransaction(line, budgetId));
}
