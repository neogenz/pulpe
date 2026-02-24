import type { Budget, BudgetLine, Transaction } from 'pulpe-shared';

export type PulseIndicator = 'good' | 'warning' | 'neutral';

/**
 * State interface for DashboardStore following the single state signal pattern
 * Simplified to work better with resource() API
 */
export interface DashboardState {
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
export function createInitialDashboardState(): DashboardState {
  return {
    currentDate: new Date(),
  };
}
