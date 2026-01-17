import { Injectable, signal } from '@angular/core';

/**
 * Caches whether the current user has at least one budget.
 * Serves as an optimization layer over the API to enable instant guard checks.
 * The cache is auto-synced by BudgetApi on every budget fetch, ensuring correctness.
 */
@Injectable({ providedIn: 'root' })
export class HasBudgetCache {
  readonly #hasBudget = signal<boolean | null>(null);

  /**
   * Returns cached value: true if user has budget, false if not, null if unknown.
   */
  hasBudget(): boolean | null {
    return this.#hasBudget();
  }

  /**
   * Sets the cached budget existence value.
   */
  setHasBudget(value: boolean): void {
    this.#hasBudget.set(value);
  }

  /**
   * Clears cache on logout or session change.
   */
  clear(): void {
    this.#hasBudget.set(null);
  }
}
