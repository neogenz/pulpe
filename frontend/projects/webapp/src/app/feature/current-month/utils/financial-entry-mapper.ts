import type { BudgetLine, Transaction } from '@pulpe/shared';
import type { FinancialEntryModel } from '../models/financial-entry.model';

/**
 * Maps a budget line to a transaction-like object for display purposes
 * This is a pure function that transforms budget lines into the transaction format
 * used by the UI components
 */
export function mapBudgetLineToFinancialEntry(
  budgetLine: BudgetLine,
  budgetId: string,
): FinancialEntryModel {
  return {
    id: budgetLine.id,
    budgetId: budgetId,
    name: budgetLine.name,
    amount: budgetLine.amount,
    kind: budgetLine.kind,
    transactionDate: new Date().toISOString(),
    createdAt: budgetLine.createdAt,
    updatedAt: budgetLine.updatedAt,
    rollover: {
      sourceBudgetId: budgetLine.rolloverSourceBudgetId ?? undefined,
    },
  };
}

export function mapTransactionToFinancialEntry(
  transaction: Transaction,
): FinancialEntryModel {
  return {
    ...transaction,
    rollover: {
      sourceBudgetId: undefined,
    },
  };
}
