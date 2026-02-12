import { effect, inject, Injectable, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetApi } from '../budget/budget-api';
import { Logger } from '../logging/logger';

/**
 * Preloads critical data immediately after authentication.
 * Uses effect() to react to isAuthenticated — fires once per login
 * (token refresh does not flip isAuthenticated).
 *
 * Must be instantiated at app startup via provideAppInitializer.
 */
@Injectable({ providedIn: 'root' })
export class PreloadService {
  readonly #authState = inject(AuthStateService);
  readonly #budgetApi = inject(BudgetApi);
  readonly #logger = inject(Logger);

  constructor() {
    effect(() => {
      if (this.#authState.isAuthenticated()) {
        untracked(() => this.#preloadCriticalData());
      }
    });
  }

  #preloadCriticalData(): void {
    this.#logger.debug('[PreloadService] Preloading critical data');

    firstValueFrom(this.#budgetApi.checkBudgetExists$()).catch((err) =>
      this.#logger.warn(
        '[PreloadService] Failed to preload budget existence',
        err,
      ),
    );

    firstValueFrom(this.#budgetApi.getAllBudgets$()).catch((err) =>
      this.#logger.warn('[PreloadService] Failed to preload budgets', err),
    );
  }
}
