import type { BudgetLine, Transaction } from 'pulpe-shared';

export interface CascadeContext {
  budgetLines: BudgetLine[];
  transactions: Transaction[];
}

export interface BudgetLineToggleResult {
  isChecking: boolean;
  updatedBudgetLines: BudgetLine[];
}

export interface TransactionToggleResult {
  isChecking: boolean;
  updatedTransactions: Transaction[];
}

export function calculateBudgetLineToggle(
  budgetLineId: string,
  context: CascadeContext,
): BudgetLineToggleResult | null {
  const budgetLine = context.budgetLines.find(
    (line) => line.id === budgetLineId,
  );
  if (!budgetLine) return null;

  const isChecking = budgetLine.checkedAt === null;
  const now = new Date().toISOString();

  const updatedBudgetLines = context.budgetLines.map((line) =>
    line.id === budgetLineId
      ? { ...line, checkedAt: isChecking ? now : null, updatedAt: now }
      : line,
  );

  return {
    isChecking,
    updatedBudgetLines,
  };
}

export function calculateTransactionToggle(
  transactionId: string,
  context: CascadeContext,
): TransactionToggleResult | null {
  const transaction = context.transactions.find(
    (tx) => tx.id === transactionId,
  );
  if (!transaction) return null;

  const isChecking = transaction.checkedAt === null;
  const now = new Date().toISOString();

  const updatedTransactions = context.transactions.map((tx) =>
    tx.id === transactionId
      ? { ...tx, checkedAt: isChecking ? now : null, updatedAt: now }
      : tx,
  );

  return {
    isChecking,
    updatedTransactions,
  };
}
