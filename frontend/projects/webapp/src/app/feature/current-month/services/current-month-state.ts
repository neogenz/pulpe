import type { Budget, BudgetLine, Transaction } from '@pulpe/shared';

/**
 * Interface describing the state managed by CurrentMonthStore
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
