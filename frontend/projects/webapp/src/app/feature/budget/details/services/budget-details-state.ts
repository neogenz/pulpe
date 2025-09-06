import { type WritableSignal, signal } from '@angular/core';

/**
 * Internal state interface following the single state signal pattern
 * Contains only the data not managed by the resource
 */
export interface BudgetDetailsState {
  /** Current budget ID being managed */
  readonly budgetId: WritableSignal<string | null>;

  /** Error message if any operation fails */
  readonly errorMessage: WritableSignal<string | null>;
}

/**
 * Initial state factory for internal state
 */
export function createInitialBudgetDetailsState(): BudgetDetailsState {
  return {
    budgetId: signal<string | null>(null),
    errorMessage: signal<string | null>(null),
  };
}
