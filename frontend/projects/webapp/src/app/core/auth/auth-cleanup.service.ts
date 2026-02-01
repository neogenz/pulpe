import { Injectable, inject, DestroyRef } from '@angular/core';

import { ClientKeyService } from '@core/encryption';

import { DemoModeService } from '../demo/demo-mode.service';
import { HasBudgetCache } from './has-budget-cache';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { Logger } from '../logging/logger';

// Debounce delay before allowing another cleanup. Prevents duplicate calls
// when multiple logout events fire in quick succession (e.g., auth state change + manual signOut).
const CLEANUP_RESET_DELAY_MS = 100;

@Injectable({
  providedIn: 'root',
})
export class AuthCleanupService {
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #demoModeService = inject(DemoModeService);
  readonly #hasBudgetCache = inject(HasBudgetCache);
  readonly #postHogService = inject(PostHogService);
  readonly #storageService = inject(StorageService);
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
    this.#handleSignOut();
  }

  #handleSignOut(): void {
    if (this.#cleanupInProgress) {
      this.#logger.debug(
        'Cleanup already in progress, skipping duplicate call',
      );
      return;
    }

    this.#cleanupInProgress = true;

    try {
      this.#safeCleanup(
        () => this.#clientKeyService.clear(),
        'client key',
      );
      this.#safeCleanup(
        () => this.#demoModeService.deactivateDemoMode(),
        'demo mode',
      );
      this.#safeCleanup(() => this.#hasBudgetCache.clear(), 'budget cache');
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
