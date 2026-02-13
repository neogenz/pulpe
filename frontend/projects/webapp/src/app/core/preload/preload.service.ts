import { effect, inject, Injectable, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetApi } from '../budget/budget-api';
import { UserSettingsApi } from '../user-settings/user-settings-api';
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
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #logger = inject(Logger);

  constructor() {
    effect(() => {
      if (this.#authState.isAuthenticated()) {
        untracked(() => this.#preloadCriticalData());
      }
    });
  }

  async #preloadCriticalData(): Promise<void> {
    this.#logger.debug('[PreloadService] Preloading critical data');

    const results = await Promise.allSettled([
      firstValueFrom(this.#budgetApi.checkBudgetExists$()),
      firstValueFrom(this.#budgetApi.getAllBudgets$()),
      this.#userSettingsApi.initialize(),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.#logger.warn(
          '[PreloadService] Preload item failed',
          result.reason,
        );
      }
    }
  }
}
