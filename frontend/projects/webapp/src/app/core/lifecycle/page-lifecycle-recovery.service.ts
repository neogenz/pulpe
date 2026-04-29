import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStore } from '@core/auth/auth-store';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { StorageService } from '@core/storage/storage.service';
import { UserSettingsStore } from '@core/user-settings';

export const PAGE_RESUME_THRESHOLD_MS = 15 * 60 * 1000;
export const PAGE_RELOAD_COOLDOWN_MS = 60 * 1000;

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
  `/${ROUTES.SETUP_VAULT_CODE}`,
  `/${ROUTES.ENTER_VAULT_CODE}`,
  `/${ROUTES.RECOVER_VAULT_CODE}`,
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
  readonly #authStore = inject(AuthStore);
  readonly #authSession = inject(AuthSessionService);
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #logger = inject(Logger);
  readonly #reload = inject(PAGE_RELOAD);
  readonly #storage = inject(StorageService);

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

    const activeElement = this.#document.activeElement as HTMLElement | null;
    if (activeElement?.closest('.mat-bottom-sheet-container')) {
      activeElement.blur();
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
    const routerUrl = this.#router.url;
    const currentUrl =
      routerUrl && routerUrl !== '/'
        ? routerUrl
        : (this.#document.defaultView?.location.pathname ?? '/');
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

    if (this.#authStore.isLoading()) {
      this.#logger.debug(
        '[PageLifecycleRecovery] Skipping recovery while auth is loading',
        {
          reason,
          route: this.#router.url,
        },
      );
      return;
    }

    if (!this.#authStore.isAuthenticated()) {
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

      this.#budgetApi.cache.invalidate(['budget']);
      this.#budgetTemplatesApi.cache.invalidate(['templates']);
      this.#userSettingsStore.reload();
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
    const now = Date.now();
    const lastReloadRaw = this.#storage.getString(
      STORAGE_KEYS.PAGE_RELOAD_COOLDOWN,
      'session',
    );
    const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;

    if (!Number.isFinite(lastReload) || lastReload <= 0) {
      return true;
    }

    return now - lastReload >= PAGE_RELOAD_COOLDOWN_MS;
  }

  #markReload(): void {
    this.#storage.setString(
      STORAGE_KEYS.PAGE_RELOAD_COOLDOWN,
      String(Date.now()),
      'session',
    );
  }
}
