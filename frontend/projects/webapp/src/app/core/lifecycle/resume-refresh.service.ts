/**
 * Refreshes app state after the page is resumed — bfcache restore, tab
 * discard, long background, or splash watchdog timeout — but only on routes
 * that hold authenticated, server-derived data and only when the user is
 * authenticated.
 *
 * **Why this exists.** After a long suspension (locked phone, backgrounded
 * tab, low-memory discard) state may be stale: the Supabase JWT may be
 * expired, SWR caches (budget, templates) may be out of sync with the
 * backend, user settings may have been changed on another device. On iOS
 * Safari specifically, `pageshow` fires before `AuthStateService` finishes
 * initializing — without explicit reconciliation the app stays frozen on the
 * splash screen.
 *
 * **What gets refreshed.** Soft path: refresh the Supabase session,
 * invalidate the budget + budget-templates SWR caches, reload user settings
 * (no full page reload, no component remount).
 *
 * **Hard reload (last resort).** Triggered when session refresh fails, soft
 * refresh throws, auth stays `isLoading` for too long after resume (see
 * `RESUME_LOADING_TIMEOUT_MS` in source), or the splash watchdog fires while
 * auth is still loading — subject to {@link PAGE_RELOAD_COOLDOWN_MS} to avoid
 * reload loops.
 *
 * Call {@link ResumeRefreshService.initialize} once at app bootstrap (see
 * `provideCore` initializer). Tests may inject {@link PAGE_RELOAD} to stub
 * reloads.
 */
import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { Logger } from '@core/logging/logger';
import { PAGE_RELOAD } from '@core/page-reload';
import { ROUTES } from '@core/routing/routes-constants';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { StorageService } from '@core/storage/storage.service';
import { UserSettingsStore } from '@core/user-settings';

export const PAGE_RESUME_THRESHOLD_MS = 15 * 60 * 1000;
export const PAGE_RELOAD_COOLDOWN_MS = 60 * 1000;

const RESUME_LOADING_TIMEOUT_MS = 12_000;

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
 * - `visibilitychange` after ≥ {@link PAGE_RESUME_THRESHOLD_MS} hidden
 * - splash watchdog timeout while auth is still loading
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
  /** `visibilitychange` to `visible` after the tab was hidden for at least
   *  {@link PAGE_RESUME_THRESHOLD_MS}. Cross-browser fallback for resume on
   *  engines that do not fire `pageshow` for non-bfcache restores. */
  | 'visibility_long_background'
  /** Splash watchdog elapsed while {@link AuthStateService.isLoading} is still
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
  readonly #authState = inject(AuthStateService);
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
  #lastHiddenAt: number | null = null;
  #refreshInFlight = false;
  #pendingReason: ResumeTriggerReason | null = null;
  #loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Effect lives in constructor (always injection context) so it does not
    // depend on where initialize() is called from.
    effect(() => {
      const isLoading = this.#authState.isLoading();
      this.#drainPendingReasonOnAuthReady(isLoading);
    });
  }

  /**
   * Drains a queued trigger reason once auth finishes loading.
   *
   * **Why a queue.** On iOS Safari, `pageshow` can fire before
   * {@link AuthStateService.isLoading} flips to `false`. Triggering refresh
   * synchronously in that window would no-op (auth gate at #triggerRefresh),
   * so we record the reason and let this drain run when auth is ready.
   */
  #drainPendingReasonOnAuthReady(isLoading: boolean): void {
    if (isLoading || this.#pendingReason === null) return;
    const reason = this.#pendingReason;
    this.#pendingReason = null;
    this.#clearLoadingTimeout();
    untracked(() => this.#triggerRefresh(reason));
  }

  readonly #onVisibilityChange = (): void => {
    if (this.#document.visibilityState === 'hidden') {
      this.#lastHiddenAt = Date.now();
      return;
    }

    if (this.#document.visibilityState !== 'visible') {
      return;
    }

    if (!this.#shouldRefreshOnResume()) {
      this.#lastHiddenAt = null;
      return;
    }

    if (this.#lastHiddenAt === null) {
      return;
    }

    const hiddenDuration = Date.now() - this.#lastHiddenAt;
    this.#lastHiddenAt = null;

    if (hiddenDuration >= PAGE_RESUME_THRESHOLD_MS) {
      this.#triggerRefresh('visibility_long_background');
    }
  };

  readonly #onPageHide = (): void => {
    this.#lastHiddenAt = Date.now();
  };

  readonly #onPageShow = (event: PageTransitionEvent): void => {
    if (!this.#shouldRefreshOnResume()) {
      return;
    }

    const wasDiscarded =
      (this.#document as Document & { wasDiscarded?: boolean }).wasDiscarded ===
      true;

    if (event.persisted) {
      this.#lastHiddenAt = null;
      this.#triggerRefresh('pageshow_persisted');
      return;
    }

    if (wasDiscarded) {
      this.#lastHiddenAt = null;
      this.#triggerRefresh('pageshow_discarded');
    }
  };

  /** Registers page lifecycle listeners; safe to call once (no-op if already done). */
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
      this.#clearLoadingTimeout();
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
   * Two-phase entry point for every refresh request.
   *
   * **Phase 1 — queue-on-loading.** If auth is still initializing, store the
   * reason in a single slot and arm a watchdog timer. The constructor effect
   * will drain the slot once `isLoading` flips to `false`. Multiple rapid
   * triggers collapse to one — the slot is overwritten, not queued.
   *
   * **Phase 2 — serialize-in-flight.** If a previous async refresh is still
   * awaiting `refreshSession`, drop the new trigger. The in-flight run already
   * captures the latest server state; a parallel run would just race for the
   * same caches.
   */
  #triggerRefresh(reason: ResumeTriggerReason): void {
    if (this.#authState.isLoading()) {
      this.#pendingReason = reason;
      this.#armLoadingTimeout(reason);
      return;
    }

    if (this.#refreshInFlight) return;
    this.#refreshInFlight = true;
    void this.#runSoftRefresh(reason).finally(() => {
      this.#refreshInFlight = false;
    });
  }

  #armLoadingTimeout(reason: ResumeTriggerReason): void {
    if (this.#loadingTimeoutId !== null) return;
    this.#loadingTimeoutId = setTimeout(() => {
      this.#loadingTimeoutId = null;
      if (!this.#authState.isLoading()) return;
      this.#pendingReason = null;
      this.#logger.warn(
        '[ResumeRefresh] Auth still loading after resume timeout, reloading',
        { reason, route: this.#router.url },
      );
      this.#triggerHardReload(reason);
    }, RESUME_LOADING_TIMEOUT_MS);
  }

  #clearLoadingTimeout(): void {
    if (this.#loadingTimeoutId === null) return;
    clearTimeout(this.#loadingTimeoutId);
    this.#loadingTimeoutId = null;
  }

  async #runSoftRefresh(reason: ResumeTriggerReason): Promise<void> {
    if (!this.#shouldRefreshOnResume()) {
      return;
    }

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
   * changed on another device) between the trigger firing and the drain
   * running. Re-check before doing any soft work — protected routes are
   * guarded by `authGuard` at navigation time, but resume is not a navigation.
   */
  #hasLiveSession(): boolean {
    return this.#authState.isAuthenticated();
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
