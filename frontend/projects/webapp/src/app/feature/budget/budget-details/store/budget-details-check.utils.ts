import type { BudgetLine, Transaction } from '@pulpe/shared';

export interface CascadeContext {
  budgetLines: BudgetLine[];
  transactions: Transaction[];
}

export interface BudgetLineToggleResult {
  isChecking: boolean;
  updatedBudgetLines: BudgetLine[];
  updatedTransactions: Transaction[];
  transactionsToToggle: Transaction[];
}

export interface TransactionToggleResult {
  isChecking: boolean;
  updatedBudgetLines: BudgetLine[];
  updatedTransactions: Transaction[];
  shouldToggleBudgetLine: boolean;
  budgetLineId: string | null;
}

export function findAllocatedTransactions(
  budgetLineId: string,
  transactions: Transaction[],
): Transaction[] {
  return transactions.filter((tx) => tx.budgetLineId === budgetLineId);
}

export function areAllAllocatedTransactionsChecked(
  budgetLineId: string,
  transactions: Transaction[],
): boolean {
  const allocated = findAllocatedTransactions(budgetLineId, transactions);
  return allocated.length > 0 && allocated.every((tx) => tx.checkedAt !== null);
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
  const allocatedTransactions = findAllocatedTransactions(
    budgetLineId,
    context.transactions,
  );

  const transactionsToToggle = allocatedTransactions.filter((tx) =>
    isChecking ? tx.checkedAt === null : tx.checkedAt !== null,
  );

  const updatedBudgetLines = context.budgetLines.map((line) =>
    line.id === budgetLineId
      ? { ...line, checkedAt: isChecking ? now : null, updatedAt: now }
      : line,
  );

  const updatedTransactions = context.transactions.map((tx) =>
    tx.budgetLineId === budgetLineId
      ? { ...tx, checkedAt: isChecking ? now : null, updatedAt: now }
      : tx,
  );

  return {
    isChecking,
    updatedBudgetLines,
    updatedTransactions,
    transactionsToToggle,
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
  const budgetLineId = transaction.budgetLineId;

  const updatedTransactions = context.transactions.map((tx) =>
    tx.id === transactionId
      ? { ...tx, checkedAt: isChecking ? now : null, updatedAt: now }
      : tx,
  );

  let updatedBudgetLines = context.budgetLines;
  let shouldToggleBudgetLine = false;

  if (budgetLineId) {
    const budgetLine = context.budgetLines.find(
      (line) => line.id === budgetLineId,
    );

    if (!isChecking && budgetLine?.checkedAt !== null) {
      updatedBudgetLines = context.budgetLines.map((line) =>
        line.id === budgetLineId
          ? { ...line, checkedAt: null, updatedAt: now }
          : line,
      );
      shouldToggleBudgetLine = true;
    } else if (isChecking) {
      const allChecked = areAllAllocatedTransactionsChecked(
        budgetLineId,
        updatedTransactions,
      );
      if (allChecked && budgetLine?.checkedAt === null) {
        updatedBudgetLines = context.budgetLines.map((line) =>
          line.id === budgetLineId
            ? { ...line, checkedAt: now, updatedAt: now }
            : line,
        );
        shouldToggleBudgetLine = true;
      }
    }
  }

  return {
    isChecking,
    updatedBudgetLines,
    updatedTransactions,
    shouldToggleBudgetLine,
    budgetLineId,
  };
}
