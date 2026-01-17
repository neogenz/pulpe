import { Injectable, signal } from '@angular/core';

/**
 * Service to coordinate cache invalidation across budget-related stores.
 *
 * Uses a signal-based pattern for cache invalidation:
 * - Stores include `version()` in their resource `params()`
 * - When `invalidate()` is called, the version increments
 * - The resource automatically reloads due to params change
 *
 * This is more idiomatic Angular 21+ than RxJS event bus.
 */
@Injectable({ providedIn: 'root' })
export class BudgetInvalidationService {
  readonly #version = signal(0);

  /**
   * Read-only signal that stores can use as a dependency
   * to trigger automatic reloading on invalidation.
   */
  readonly version = this.#version.asReadonly();

  /**
   * Call this after any budget mutation (create, update, delete)
   * to trigger cache invalidation across all listening stores.
   */
  invalidate(): void {
    this.#version.update((v) => v + 1);
  }
}
