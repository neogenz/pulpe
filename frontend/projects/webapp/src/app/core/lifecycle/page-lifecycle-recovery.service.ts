import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { UserSettingsApi } from '@core/user-settings';

export const PAGE_RESUME_THRESHOLD_MS = 15 * 60 * 1000;
export const PAGE_RELOAD_COOLDOWN_MS = 60 * 1000;
const RELOAD_COOLDOWN_STORAGE_KEY = 'pulpe-page-reload-cooldown-at';

export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.defaultView?.location.reload();
  },
});

const PROTECTED_ROUTE_PREFIXES = [
  `/${ROUTES.DASHBOARD}`,
  `/${ROUTES.BUDGET}`,
  `/${ROUTES.BUDGET_TEMPLATES}`,
  `/${ROUTES.SETTINGS}`,
  `/${ROUTES.COMPLETE_PROFILE}`,
] as const;

type ResumeTriggerReason =
  | 'pageshow_persisted'
  | 'pageshow_discarded'
  | 'visibility_long_background';

@Injectable({ providedIn: 'root' })
export class PageLifecycleRecoveryService {
  readonly #document = inject(DOCUMENT);
  readonly #destroyRef = inject(DestroyRef);
  readonly #router = inject(Router);
  readonly #authState = inject(AuthStateService);
  readonly #authSession = inject(AuthSessionService);
  readonly #budgetInvalidation = inject(BudgetInvalidationService);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #logger = inject(Logger);
  readonly #reload = inject(PAGE_RELOAD);

  #initialized = false;
  #lastHiddenAt: number | null = null;
  #recoveryInFlight = false;

  readonly #onVisibilityChange = (): void => {
    if (this.#document.visibilityState === 'hidden') {
      this.#lastHiddenAt = Date.now();
      return;
    }

    if (this.#document.visibilityState !== 'visible') {
      return;
    }

    if (!this.#isOnProtectedRoute()) {
      this.#lastHiddenAt = null;
      return;
    }

    if (this.#lastHiddenAt === null) {
      return;
    }

    const hiddenDuration = Date.now() - this.#lastHiddenAt;
    this.#lastHiddenAt = null;

    if (hiddenDuration >= PAGE_RESUME_THRESHOLD_MS) {
      this.#triggerResumeRecovery('visibility_long_background');
    }
  };

  readonly #onPageHide = (): void => {
    this.#lastHiddenAt = Date.now();
  };

  readonly #onPageShow = (event: PageTransitionEvent): void => {
    if (!this.#isOnProtectedRoute()) {
      return;
    }

    const wasDiscarded =
      (this.#document as Document & { wasDiscarded?: boolean }).wasDiscarded ===
      true;

    if (event.persisted) {
      this.#lastHiddenAt = null;
      this.#triggerResumeRecovery('pageshow_persisted');
      return;
    }

    if (wasDiscarded) {
      this.#lastHiddenAt = null;
      this.#triggerResumeRecovery('pageshow_discarded');
    }
  };

  initialize(): void {
    if (this.#initialized) return;
    this.#initialized = true;

    const win = this.#document.defaultView;
    if (!win) return;

    this.#document.addEventListener(
      'visibilitychange',
      this.#onVisibilityChange,
    );
    win.addEventListener('pagehide', this.#onPageHide);
    win.addEventListener('pageshow', this.#onPageShow);

    this.#destroyRef.onDestroy(() => {
      this.#document.removeEventListener(
        'visibilitychange',
        this.#onVisibilityChange,
      );
      win.removeEventListener('pagehide', this.#onPageHide);
      win.removeEventListener('pageshow', this.#onPageShow);
    });
  }

  #isOnProtectedRoute(): boolean {
    const currentUrl =
      this.#router.url || this.#document.defaultView?.location.pathname || '';
    const path = currentUrl.split('?')[0];

    return PROTECTED_ROUTE_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }

  #triggerResumeRecovery(reason: ResumeTriggerReason): void {
    if (this.#recoveryInFlight) {
      return;
    }

    this.#recoveryInFlight = true;
    void this.#runResumeRecovery(reason).finally(() => {
      this.#recoveryInFlight = false;
    });
  }

  async #runResumeRecovery(reason: ResumeTriggerReason): Promise<void> {
    if (!this.#isOnProtectedRoute()) {
      return;
    }

    if (this.#authState.isLoading()) {
      this.#logger.debug(
        '[PageLifecycleRecovery] Skipping recovery while auth is loading',
        {
          reason,
          route: this.#router.url,
        },
      );
      return;
    }

    if (!this.#authState.isAuthenticated()) {
      return;
    }

    try {
      const sessionRefreshed = await this.#authSession.refreshSession();
      if (!sessionRefreshed) {
        this.#logger.warn(
          '[PageLifecycleRecovery] Session refresh failed after resume, reloading app',
          { reason, route: this.#router.url },
        );
        this.#triggerRecoveryReload(reason);
        return;
      }

      this.#budgetInvalidation.invalidate();
      this.#userSettingsApi.reload();
      this.#logger.info(
        '[PageLifecycleRecovery] Soft recovery completed after resume',
        { reason, route: this.#router.url },
      );
    } catch (error) {
      this.#logger.warn(
        '[PageLifecycleRecovery] Soft recovery failed after resume, reloading app',
        { reason, route: this.#router.url, error },
      );
      this.#triggerRecoveryReload(reason);
    }
  }

  #triggerRecoveryReload(reason: ResumeTriggerReason): void {
    if (!this.#shouldReload()) {
      return;
    }

    this.#markReload();
    this.#logger.warn('[PageLifecycleRecovery] Reloading app after resume', {
      reason,
      route: this.#router.url,
    });
    this.#reload();
  }

  #shouldReload(): boolean {
    const storage = this.#document.defaultView?.sessionStorage;
    if (!storage) return true;

    const now = Date.now();
    const lastReloadRaw = storage.getItem(RELOAD_COOLDOWN_STORAGE_KEY);
    const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;

    if (!Number.isFinite(lastReload) || lastReload <= 0) {
      return true;
    }

    return now - lastReload >= PAGE_RELOAD_COOLDOWN_MS;
  }

  #markReload(): void {
    this.#document.defaultView?.sessionStorage.setItem(
      RELOAD_COOLDOWN_STORAGE_KEY,
      String(Date.now()),
    );
  }
}
