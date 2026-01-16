import { Injectable, inject, DestroyRef } from '@angular/core';
import { AuthStateService } from './auth-state.service';
import { DemoModeService } from '../demo/demo-mode.service';
import { HasBudgetCache } from './has-budget-cache';
import { PostHogService } from '../analytics/posthog';
import { StorageService } from '../storage';
import { Logger } from '../logging/logger';

const CLEANUP_RESET_DELAY_MS = 100;

@Injectable({
  providedIn: 'root',
})
export class AuthCleanupService {
  readonly #state = inject(AuthStateService);
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

  performCleanup(userId?: string): void {
    this.#handleSignOut(userId);
  }

  #handleSignOut(userId?: string): void {
    if (this.#cleanupInProgress) {
      this.#logger.debug(
        'Cleanup already in progress, skipping duplicate call',
      );
      return;
    }

    this.#cleanupInProgress = true;

    try {
      this.#state.setLoading(false);
      this.#demoModeService.deactivateDemoMode();
      this.#hasBudgetCache.clear();
      this.#postHogService.reset();
      this.#storageService.clearAll(userId);
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
}
