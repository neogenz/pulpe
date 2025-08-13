import type { Budget, BudgetLine, Transaction } from '@pulpe/shared';

/**
 * Interface describing the state managed by CurrentMonthStore
 * This is for backward compatibility and represents the combined view
 */
export interface CurrentMonthState {
  /**
   * Dashboard data containing budget, transactions, and budget lines
   */
  dashboardData: DashboardData | null;

  /**
   * Loading state for async operations
   */
  isLoading: boolean;

  /**
   * Error state for failed operations
   */
  error: Error | null;

  /**
   * Current date used for calculations and data fetching
   */
  currentDate: Date;

  /**
   * Set of operations currently in progress (for optimistic updates)
   */
  operationsInProgress: Set<string>;
}

/**
 * Internal state interface for CurrentMonthStore following the single state signal pattern
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
