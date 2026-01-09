import type { Budget, BudgetLine, Transaction } from 'pulpe-shared';

/**
 * State interface for CurrentMonthStore following the single state signal pattern
 * Simplified to work better with resource() API
 */
export interface CurrentMonthState {
  /**
   * Current date used for calculations and data fetching
   */
  currentDate: Date;
}

/**
 * Dashboard data structure returned by the resource
 */
export interface DashboardData {
  budget: Budget | null;
  transactions: Transaction[];
  budgetLines: BudgetLine[];
}

/**
 * Factory function to create initial internal state
 */
export function createInitialCurrentMonthInternalState(): CurrentMonthState {
  return {
    currentDate: new Date(),
  };
}
