import { effect, inject, Injectable, untracked } from '@angular/core';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetCache } from '../budget/budget-cache';
import { TemplateCache } from '../template/template-cache';
import { Logger } from '../logging/logger';

@Injectable({ providedIn: 'root' })
export class AppPreloader {
  readonly #authState = inject(AuthStateService);
  readonly #budgetCache = inject(BudgetCache);
  readonly #templateCache = inject(TemplateCache);
  readonly #logger = inject(Logger);

  // Plain boolean (not a signal) — intentional. The effect() only needs to
  // react to isAuthenticated(); #isPreloading acts as a reentrancy guard
  // checked both in the effect and at #preloadAll entry (line 30).
  #isPreloading = false;

  initializePreloading(): void {
    effect(() => {
      const isAuthenticated = this.#authState.isAuthenticated();

      if (isAuthenticated && !this.#isPreloading) {
        untracked(() => this.#preloadAll());
      }
    });
  }

  async #preloadAll(): Promise<void> {
    if (this.#isPreloading) return;
    this.#isPreloading = true;

    this.#logger.debug('[AppPreloader] Starting background preload');

    try {
      // Two-phase preload: list then details — see DR-006 in memory-bank/techContext.md
      const [budgets] = await Promise.all([
        this.#budgetCache.preloadBudgetList(),
        this.#templateCache.preloadAll(),
      ]);

      // Phase 2: Preload all budget details in parallel
      if (budgets.length > 0) {
        await this.#budgetCache.preloadBudgetDetails(budgets.map((b) => b.id));
      }

      this.#logger.debug('[AppPreloader] Background preload complete');
    } catch (error) {
      this.#logger.error('[AppPreloader] Background preload failed', error);
    } finally {
      this.#isPreloading = false;
    }
  }

  reset(): void {
    this.#isPreloading = false;
    this.#budgetCache.clear();
    this.#templateCache.clear();
  }
}
