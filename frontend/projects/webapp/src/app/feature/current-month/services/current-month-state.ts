import type { Budget, BudgetLine, Transaction } from '@pulpe/shared';

/**
 * State interface for CurrentMonthStore following the single state signal pattern
 * Contains only the data not managed by the resource
 */
export interface CurrentMonthInternalState {
  /**
   * Current date used for calculations and data fetching
   */
  currentDate: Date;

  /**
   * Set of operations currently in progress (for optimistic updates)
   */
  operationsInProgress: Set<string>;

  /**
   * Optimistic updates state - overlays on top of resource data
   */
  optimisticUpdates: {
    addedTransactions: Transaction[];
    removedTransactionIds: Set<string>;
  };
}

/**
 * Dashboard data structure
 */
export interface DashboardData {
  budget: Budget | null;
  transactions: Transaction[];
  budgetLines: BudgetLine[];
}

/**
 * Transaction creation data (omitting generated fields)
 */
export type TransactionCreateData = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'userId'
>;

/**
 * Factory function to create initial internal state
 */
export function createInitialCurrentMonthInternalState(): CurrentMonthInternalState {
  return {
    currentDate: new Date(),
    operationsInProgress: new Set(),
    optimisticUpdates: {
      addedTransactions: [],
      removedTransactionIds: new Set(),
    },
  };
}
