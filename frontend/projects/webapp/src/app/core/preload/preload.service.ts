import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type Budget } from 'pulpe-shared';
import { AuthStateService } from '../auth/auth-state.service';
import { BudgetApi } from '../budget/budget-api';
import { ClientKeyService } from '../encryption/client-key.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { Logger } from '../logging/logger';

/**
 * Preloads critical data immediately after authentication.
 * Uses effect() to react to isAuthenticated + hasClientKey — fires once
 * both conditions are met (after vault code entry or demo mode).
 *
 * Must be instantiated at app startup via provideAppInitializer.
 *
 * Note: UserSettingsApi is NOT preloaded here — its internal resource()
 * auto-loads when isReady becomes true (same condition as this effect),
 * so calling initialize() would cause a duplicate request.
 */
@Injectable({ providedIn: 'root' })
export class PreloadService {
  readonly #authState = inject(AuthStateService);
  readonly #budgetApi = inject(BudgetApi);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #demoMode = inject(DemoModeService);
  readonly #logger = inject(Logger);

  readonly #hasPreloaded = signal(false);

  reset(): void {
    this.#hasPreloaded.set(false);
  }

  constructor() {
    effect(() => {
      const isReady =
        this.#authState.isAuthenticated() &&
        (this.#clientKeyService.hasClientKey() || this.#demoMode.isDemoMode());

      if (isReady && !untracked(this.#hasPreloaded)) {
        this.#hasPreloaded.set(true);
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

    // Prefetch current month's budget details (fire-and-forget)
    this.#prefetchCurrentMonthDetails();
  }

  #prefetchCurrentMonthDetails(): void {
    const cached = this.#budgetApi.cache.get<Budget[]>(['budget', 'list']);
    if (!cached) return;

    const budgets = cached.data;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentBudget = budgets.find(
      (b) => b.month === currentMonth && b.year === currentYear,
    );

    if (!currentBudget) return;

    // Prefetch current month's details (fire-and-forget, deduped)
    // Transform to BudgetDetailsViewModel so the cache entry matches
    // what BudgetDetailsStore expects from this key
    this.#budgetApi.cache
      .deduplicate(['budget', 'details', currentBudget.id], async () => {
        const response = await firstValueFrom(
          this.#budgetApi.getBudgetWithDetails$(currentBudget.id),
        );
        const viewModel = {
          ...response.data.budget,
          budgetLines: response.data.budgetLines,
          transactions: response.data.transactions,
        };
        return viewModel;
      })
      .catch((error) => {
        this.#logger.warn(
          '[PreloadService] Failed to prefetch current month details',
          error,
        );
      });
  }
}
