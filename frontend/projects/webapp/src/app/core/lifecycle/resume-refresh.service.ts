/**
 * Refreshes app state after the page is resumed via bfcache restore, tab
 * discard, or splash watchdog timeout — but only on routes that hold
 * authenticated, server-derived data and only when the user is authenticated.
 *
 * **Why this exists.** After a long suspension (locked phone, backgrounded
 * tab, low-memory discard) state may be stale: SWR caches (budget, templates)
 * may be out of sync with the backend, user settings may have been changed on
 * another device. On iOS Safari specifically, an app-switch restore fires
 * `pageshow.persisted=true` but does NOT fire `visibilitychange`, so the
 * Supabase SDK's own visibilitychange listener cannot recover the session
 * here — this service owns the bfcache surface.
 *
 * **The hung-fetch failsafe.** WebKit silently aborts in-flight `fetch()`
 * calls when a tab enters bfcache (webkit.org/b/282506). If the user
 * backgrounds the app DURING the initial `getSession()` round-trip, the
 * Promise never resolves and never rejects — `AuthStore.isLoading()` stays
 * `true` forever. On resume we detect this and reload immediately rather
 * than waiting on a Promise that will never settle.
 *
 * **Scope vs Supabase auth-js.** The Supabase JS SDK (auth-js >= 2.71)
 * registers its own `visibilitychange` listener that refreshes the session
 * on tab-foreground transitions — those are handled by the SDK, not by this
 * service. This service only owns the surfaces the SDK does NOT cover:
 * `pageshow.persisted` (bfcache) + `document.wasDiscarded` (low-memory
 * discard), plus Pulpe-specific cache invalidation (`budget`, `templates`)
 * and `userSettings` reload.
 *
 * **What gets refreshed.** Soft path: refresh the Supabase session,
 * invalidate the budget + budget-templates SWR caches, reload user settings
 * (no full page reload, no component remount).
 *
 * **Hard reload (last resort).** Triggered when (a) `isLoading=true` at
 * resume (hung-fetch detection), (b) session refresh fails, (c) soft refresh
 * throws, or (d) the splash watchdog fires while auth is still loading —
 * all subject to {@link PAGE_RELOAD_COOLDOWN_MS} to avoid reload loops.
 *
 * Call {@link ResumeRefreshService.initialize} once at app bootstrap (see
 * `provideCore` initializer). Tests may inject {@link PAGE_RELOAD} to stub
 * reloads.
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

/**
 * Routes whose state may go stale after the app is suspended, restored from
 * bfcache, or discarded.
 *
 * **What "stale" means here.** Authenticated, server-derived state that the
 * UI reads on load: the Supabase session/JWT, budget + template SWR caches,
 * user settings, and vault-encryption state. Public routes (login, welcome,
 * legal) do not need this — their state is either anonymous or read-only.
 *
 * **When the refresh pipeline runs.** {@link ResumeRefreshService} checks
 * this list against the current route on:
 * - `pageshow` with `event.persisted === true` (bfcache restore, Safari/Firefox)
 * - `pageshow` with `document.wasDiscarded === true` (low-memory tab discard)
 * - splash watchdog timeout while auth is still loading
 *
 * Tab-foreground/long-background transitions are handled by the Supabase
 * SDK's own `visibilitychange` listener — no duplicate listener here.
 *
 * **Adding a new authenticated zone.** Append the route prefix here and to
 * `ROUTES`. No other change required — the service walks the list.
 *
 * @see ResumeRefreshService
 */
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

/**
 * Origin of a refresh request. Each value documents which DOM signal raised
 * it and what semantic it carries — kept narrow so logs and tests can attribute
 * cause to symptom.
 */
type ResumeTriggerReason =
  /** `pageshow.persisted === true`. Browser restored the page from bfcache
   *  (typical iOS Safari resume). DOM tree is intact, JS state survived,
   *  but server-side state may have moved on. */
  | 'pageshow_persisted'
  /** `pageshow` with `document.wasDiscarded === true`. Browser discarded the
   *  tab under memory pressure and just rebuilt it. Treat like a cold start
   *  on the same URL. */
  | 'pageshow_discarded'
  /** `pageshow` fired with {@link AuthStore.isLoading} still `true`. WebKit
   *  silently aborted the in-flight `getSession()` on bfcache enter; the
   *  Promise will never settle. Force a reload to break the hang. */
  | 'pageshow_hung_fetch'
  /** Splash watchdog elapsed while {@link AuthStore.isLoading} is still
   *  true. Last-resort signal that auth init never resolved — escalates to
   *  hard reload. Raised by `core/lifecycle/splash-removal.ts`. */
  | 'splash_timeout';

/**
 * Coordinates soft state refresh and guarded full reload after page resume
 * events on authenticated routes.
 *
 * @see ROUTES_REFRESHED_ON_RESUME
 */
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
  readonly #reloadCooldown = new ReloadCooldown(
    inject(StorageService),
    PAGE_RELOAD_COOLDOWN_MS,
  );

  #initialized = false;
  #refreshInFlight = false;

  readonly #onPageShow = (event: PageTransitionEvent): void => {
    if (!this.#shouldRefreshOnResume()) {
      return;
    }

    const wasDiscarded =
      (this.#document as Document & { wasDiscarded?: boolean }).wasDiscarded ===
      true;

    if (!event.persisted && !wasDiscarded) {
      return;
    }

    if (this.#authStore.isLoading()) {
      this.#triggerHardReload('pageshow_hung_fetch');
      return;
    }

    this.#triggerRefresh(
      event.persisted ? 'pageshow_persisted' : 'pageshow_discarded',
    );
  };

  /** Registers page lifecycle listeners; safe to call once (no-op if already done). */
  initialize(): void {
    if (this.#initialized) return;
    this.#initialized = true;

    const win = this.#document.defaultView;
    if (!win) return;

    win.addEventListener('pageshow', this.#onPageShow);

    this.#destroyRef.onDestroy(() => {
      win.removeEventListener('pageshow', this.#onPageShow);
    });
  }

  /**
   * Last-resort reload when the splash timeout fires while auth is still loading.
   * @returns whether a reload was actually scheduled (false if cooldown blocked it).
   */
  forceReloadOnSplashTimeout(): boolean {
    return this.#triggerHardReload('splash_timeout');
  }

  #shouldRefreshOnResume(): boolean {
    const routerUrl = this.#router.url;
    const currentUrl =
      routerUrl && routerUrl !== '/'
        ? routerUrl
        : (this.#document.defaultView?.location.pathname ?? '/');
    const path = currentUrl.split('?')[0];

    return ROUTES_REFRESHED_ON_RESUME.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }

  /**
   * Drops parallel triggers while a previous async refresh is still awaiting
   * `refreshSession`. The in-flight run already captures the latest server
   * state; a parallel run would just race for the same caches.
   */
  #triggerRefresh(reason: ResumeTriggerReason): void {
    if (this.#refreshInFlight) return;
    this.#refreshInFlight = true;
    void this.#runSoftRefresh(reason).finally(() => {
      this.#refreshInFlight = false;
    });
  }

  async #runSoftRefresh(reason: ResumeTriggerReason): Promise<void> {
    if (!this.#hasLiveSession()) {
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
      this.#logger.warn(
        '[ResumeRefresh] Soft refresh failed after resume, reloading app',
        { reason, route: this.#router.url, error },
      );
      this.#triggerHardReload(reason);
    }
  }

  /**
   * A backgrounded session can be revoked server-side (token rotated, password
   * changed on another device). Re-check before doing any soft work —
   * protected routes are guarded by `authGuard` at navigation time, but resume
   * is not a navigation.
   */
  #hasLiveSession(): boolean {
    return this.#authStore.isAuthenticated();
  }

  #triggerHardReload(reason: ResumeTriggerReason): boolean {
    if (!this.#reloadCooldown.shouldReload()) {
      return false;
    }

    this.#reloadCooldown.markReload();
    this.#logger.warn('[ResumeRefresh] Reloading app after resume', {
      reason,
      route: this.#router.url,
    });
    this.#reload();
    return true;
  }
}

/**
 * Persists the timestamp of the last hard reload in sessionStorage so rapid
 * resume events cannot trigger a reload loop. Scope is per-tab — a fresh tab
 * starts with no cooldown, which is the correct semantic for a brand-new session.
 */
class ReloadCooldown {
  readonly #storage: StorageService;
  readonly #cooldownMs: number;

  constructor(storage: StorageService, cooldownMs: number) {
    this.#storage = storage;
    this.#cooldownMs = cooldownMs;
  }

  shouldReload(): boolean {
    const now = Date.now();
    const lastReloadRaw = this.#storage.getString(
      STORAGE_KEYS.PAGE_RELOAD_COOLDOWN,
      'session',
    );
    const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;

    if (!Number.isFinite(lastReload) || lastReload <= 0) {
      return true;
    }

    return now - lastReload >= this.#cooldownMs;
  }

  markReload(): void {
    this.#storage.setString(
      STORAGE_KEYS.PAGE_RELOAD_COOLDOWN,
      String(Date.now()),
      'session',
    );
  }
}
