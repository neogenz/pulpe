/**
 * Refreshes app state after page resume on authenticated routes.
 *
 * iOS Safari fires `pageshow.persisted=true` on app-switch restore but does
 * NOT fire `visibilitychange`, so Supabase auth-js's own listener cannot
 * recover the session. This service owns the bfcache surface.
 *
 * WebKit silently aborts in-flight `fetch()` when a tab enters bfcache
 * (webkit.org/b/282506). On `pageshow.persisted=true` with `isLoading=true`,
 * the initial `getSession()` Promise will never settle — reload immediately.
 * Discarded tabs (`persisted=false` + `wasDiscarded=true`) are cold reloads
 * where `isLoading=true` is normal bootstrap, not a hang.
 */
import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStore } from '@core/auth/auth-store';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { Logger } from '@core/logging/logger';
import { PAGE_RELOAD } from '@core/page-reload';
import { ROUTES } from '@core/routing/routes-constants';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { StorageService } from '@core/storage/storage.service';
import { UserSettingsStore } from '@core/user-settings';

export const PAGE_RELOAD_COOLDOWN_MS = 60 * 1000;

/** Authenticated routes whose server-derived state may go stale on resume. */
const ROUTES_REFRESHED_ON_RESUME = [
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
  | 'pageshow_hung_fetch'
  | 'splash_timeout';

@Injectable({ providedIn: 'root' })
export class ResumeRefreshService {
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

  #isInitialized = false;
  #isRefreshInFlight = false;

  readonly #onPageShow = (event: PageTransitionEvent): void => {
    if (!this.#shouldRefreshOnResume()) {
      return;
    }

    if (event.persisted) {
      if (this.#authStore.isLoading()) {
        this.#triggerHardReload('pageshow_hung_fetch');
        return;
      }
      this.#triggerRefresh('pageshow_persisted');
      return;
    }

    const wasDiscarded =
      (this.#document as Document & { wasDiscarded?: boolean }).wasDiscarded ===
      true;

    if (wasDiscarded) {
      this.#triggerRefresh('pageshow_discarded');
    }
  };

  initialize(): void {
    if (this.#isInitialized) return;
    this.#isInitialized = true;

    const win = this.#document.defaultView!;
    win.addEventListener('pageshow', this.#onPageShow);

    this.#destroyRef.onDestroy(() => {
      win.removeEventListener('pageshow', this.#onPageShow);
    });
  }

  /**
   * Hard reload triggered when splash timeout fires while auth is still loading.
   * @returns false if blocked by cooldown.
   */
  forceReloadOnSplashTimeout(): boolean {
    return this.#triggerHardReload('splash_timeout');
  }

  #shouldRefreshOnResume(): boolean {
    const routerUrl = this.#router.url;
    const currentUrl =
      routerUrl && routerUrl !== '/'
        ? routerUrl
        : this.#document.defaultView!.location.pathname;
    const path = currentUrl.split('?')[0];

    return ROUTES_REFRESHED_ON_RESUME.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }

  // Drop parallel triggers — in-flight run already captures latest server state.
  #triggerRefresh(reason: ResumeTriggerReason): void {
    if (this.#isRefreshInFlight) return;
    this.#isRefreshInFlight = true;
    void this.#runSoftRefresh(reason).finally(() => {
      this.#isRefreshInFlight = false;
    });
  }

  async #runSoftRefresh(reason: ResumeTriggerReason): Promise<void> {
    // Resume is not a navigation — re-verify session (server-side revoke possible).
    if (!this.#authStore.isAuthenticated()) {
      return;
    }

    try {
      const sessionRefreshed = await this.#authSession.refreshSession();
      if (!sessionRefreshed) {
        this.#logger.warn(
          '[ResumeRefresh] Session refresh failed after resume, reloading app',
          { reason, route: this.#router.url },
        );
        this.#triggerHardReload(reason);
        return;
      }

      this.#budgetApi.cache.invalidate(['budget']);
      this.#budgetTemplatesApi.cache.invalidate(['templates']);
      this.#userSettingsStore.reload();
      this.#logger.info('[ResumeRefresh] Soft refresh completed after resume', {
        reason,
        route: this.#router.url,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.#logger.warn(
        '[ResumeRefresh] Soft refresh failed after resume, reloading app',
        { reason, route: this.#router.url, error: err },
      );
      this.#triggerHardReload(reason);
    }
  }

  #triggerHardReload(reason: ResumeTriggerReason): boolean {
    if (!this.#shouldReload()) {
      return false;
    }

    this.#markReload();
    this.#logger.warn('[ResumeRefresh] Reloading app after resume', {
      reason,
      route: this.#router.url,
    });
    this.#reload();
    return true;
  }

  // Per-tab cooldown via sessionStorage — fresh tab = no cooldown (correct for new sessions).
  #shouldReload(): boolean {
    const lastReload = Number(
      this.#storage.getString(STORAGE_KEYS.PAGE_RELOAD_COOLDOWN, 'session') ??
        0,
    );
    if (!Number.isFinite(lastReload) || lastReload <= 0) return true;
    return Date.now() - lastReload >= PAGE_RELOAD_COOLDOWN_MS;
  }

  #markReload(): void {
    this.#storage.setString(
      STORAGE_KEYS.PAGE_RELOAD_COOLDOWN,
      String(Date.now()),
      'session',
    );
  }
}
