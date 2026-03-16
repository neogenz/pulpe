import { Injectable, inject, DestroyRef } from '@angular/core';

import { BudgetApi } from '@core/budget';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { ClientKeyService } from '@core/encryption';

import { DemoModeService } from '../demo/demo-mode.service';
import { PreloadService } from '../preload/preload.service';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { UserSettingsStore } from '../user-settings/user-settings-store';
import { Logger } from '../logging/logger';

const CLEANUP_RESET_DELAY_MS = 100;

@Injectable({
  providedIn: 'root',
})
export class AuthCleanupService {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #demoModeService = inject(DemoModeService);
  readonly #preloadService = inject(PreloadService);
  readonly #postHogService = inject(PostHogService);
  readonly #storageService = inject(StorageService);
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #logger = inject(Logger);
  readonly #destroyRef = inject(DestroyRef);

  #cleanupInProgress = false;
  #resetTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      if (this.#resetTimeoutId !== null) {
        clearTimeout(this.#resetTimeoutId);
        this.#resetTimeoutId = null;
      }
    });
  }

  performCleanup(): void {
    if (this.#cleanupInProgress) {
      this.#logger.debug(
        'Cleanup already in progress, skipping duplicate call',
      );
      return;
    }

    this.#cleanupInProgress = true;

    try {
      this.#safeCleanup(
        () => this.#clientKeyService.clearPreservingDeviceTrust(),
        'client key',
      );
      this.#safeCleanup(
        () => this.#demoModeService.deactivateDemoMode(),
        'demo mode',
      );
      this.#safeCleanup(
        () => this.#budgetApi.clearCache(),
        'budget data cache',
      );
      this.#safeCleanup(
        () => this.#budgetTemplatesApi.clearCache(),
        'templates data cache',
      );
      this.#safeCleanup(() => this.#preloadService.reset(), 'preload state');
      this.#safeCleanup(() => this.#userSettingsStore.reset(), 'user settings');
      this.#safeCleanup(() => this.#postHogService.reset(), 'PostHog');
      this.#safeCleanup(
        () => this.#storageService.clearAllUserData(),
        'storage',
      );
    } finally {
      if (this.#resetTimeoutId !== null) {
        clearTimeout(this.#resetTimeoutId);
      }

      this.#resetTimeoutId = setTimeout(() => {
        this.#cleanupInProgress = false;
        this.#resetTimeoutId = null;
      }, CLEANUP_RESET_DELAY_MS);
    }
  }

  #safeCleanup(operation: () => void, name: string): void {
    try {
      operation();
    } catch (error) {
      this.#logger.error(`Cleanup failed: ${name}`, { error });
    }
  }
}
