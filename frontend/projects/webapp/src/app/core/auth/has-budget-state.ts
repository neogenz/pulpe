import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether the current user has at least one budget.
 * Used to cache hasBudgetGuard result and avoid repeated API calls on navigation.
 */
@Injectable({ providedIn: 'root' })
export class HasBudgetState {
  readonly #hasBudget = signal<boolean | null>(null);

  /**
   * Returns cached value: true if user has budget, false if not, null if unknown.
   */
  get(): boolean | null {
    return this.#hasBudget();
  }

  /**
   * Cache that user has at least one budget.
   */
  setHasBudget(): void {
    this.#hasBudget.set(true);
  }

  /**
   * Cache that user has no budgets.
   */
  setNoBudget(): void {
    this.#hasBudget.set(false);
  }

  /**
   * Clear cache (on logout or when budget is created/deleted).
   */
  clear(): void {
    this.#hasBudget.set(null);
  }
}
