import type { ResourceRef } from '@angular/core';
import type { BudgetDetailsResponse } from '@pulpe/shared';

/**
 * State interface for budget details management
 * Represents the internal state structure of BudgetDetailsStore
 */
export interface BudgetDetailsState {
  /** Current budget ID being managed */
  readonly budgetId: string | null;

  /** Resource reference for budget details data */
  readonly budgetDetails: ResourceRef<BudgetDetailsResponse | undefined> | null;

  /** Set of operation IDs currently in progress */
  readonly operationsInProgress: ReadonlySet<string>;

  /** Loading state indicator */
  readonly isLoading: boolean;

  /** Error state from last operation */
  readonly error: string | null;
}

/**
 * Initial state factory for BudgetDetailsState
 */
export function createInitialBudgetDetailsState(): BudgetDetailsState {
  return {
    budgetId: null,
    budgetDetails: null,
    operationsInProgress: new Set(),
    isLoading: false,
    error: null,
  };
}
