import { effect, inject, Injectable, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetApi } from '../budget/budget-api';
import { ClientKeyService } from '../encryption/client-key.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { UserSettingsApi } from '../user-settings/user-settings-api';
import { Logger } from '../logging/logger';

/**
 * Preloads critical data immediately after authentication.
 * Uses effect() to react to isAuthenticated + hasClientKey — fires once
 * both conditions are met (after vault code entry or demo mode).
 *
 * Must be instantiated at app startup via provideAppInitializer.
 */
@Injectable({ providedIn: 'root' })
export class PreloadService {
  readonly #authState = inject(AuthStateService);
  readonly #budgetApi = inject(BudgetApi);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #demoMode = inject(DemoModeService);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #logger = inject(Logger);

  constructor() {
    effect(() => {
      const isReady =
        this.#authState.isAuthenticated() &&
        (this.#clientKeyService.hasClientKey() || this.#demoMode.isDemoMode());

      if (isReady) {
        untracked(() => this.#preloadCriticalData());
      }
    });
  }

  async #preloadCriticalData(): Promise<void> {
    this.#logger.debug('[PreloadService] Preloading critical data');

    const operations = [
      {
        name: 'checkBudgetExists',
        task: firstValueFrom(this.#budgetApi.checkBudgetExists$()),
      },
      {
        name: 'getAllBudgets',
        task: firstValueFrom(this.#budgetApi.getAllBudgets$()),
      },
      { name: 'userSettings', task: this.#userSettingsApi.initialize() },
    ];

    const results = await Promise.allSettled(operations.map((op) => op.task));

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#logger.warn(
          `[PreloadService] Failed to preload ${operations[index].name}`,
          result.reason,
        );
      }
    });
  }
}
