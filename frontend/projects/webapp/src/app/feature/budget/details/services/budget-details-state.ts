/**
 * Internal state interface following the single state signal pattern
 * Contains only the data not managed by the resource
 */
export interface BudgetDetailsState {
  /** Current budget ID being managed */
  readonly budgetId: string | null;

  /** Set of operation IDs currently in progress */
  readonly operationsInProgress: Set<string>;

  /** Error state from operations (non-resource errors) */
  readonly error: string | null;
}

/**
 * Initial state factory for internal state
 */
export function createInitialBudgetDetailsState(): BudgetDetailsState {
  return {
    budgetId: null,
    operationsInProgress: new Set(),
    error: null,
  };
}
