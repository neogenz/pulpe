import { Service, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PostHog, Properties, CaptureResult } from 'posthog-js';
import { ANALYTICS_EVENTS, type AnalyticsEventName } from 'pulpe-shared';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { buildInfo } from '@env/build-info';
import { sanitizeEventPayload, sanitizeUrl } from './posthog-sanitizer';

const POSTHOG_PERSISTENCE_NAME = 'pulpe_app';

function expireLegacySharedCookie(apiKey: string): void {
  const expiredCookie = `ph_${apiKey}_posthog=; Max-Age=0; Path=/; SameSite=Lax`;
  document.cookie = expiredCookie;
  if (
    location.hostname === 'pulpe.app' ||
    location.hostname.endsWith('.pulpe.app')
  ) {
    document.cookie = `${expiredCookie}; Domain=.pulpe.app`;
  }
}

/**
 * PostHog service for analytics and error tracking.
 * Uses PostHog's built-in privacy protection and minimal configuration.
 */
@Service()
export class PostHogService {
  readonly #applicationConfiguration = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #platformId = inject(PLATFORM_ID);
  readonly #storageService = inject(StorageService);

  #posthog: PostHog | null = null;
  readonly #isInitialized = signal<boolean>(false);
  readonly #flagsVersion = signal<number>(0);
  readonly #diagnosticSharingEnabled = signal(true);
  #isTrackingEnabled = false;
  #sessionReplayEnabled = false;

  constructor() {
    const overrides = this.#readFlagOverrides();
    if (overrides) {
      queueMicrotask(() => this.#flagsVersion.update((v) => v + 1));
    }
  }

  readonly isInitialized = this.#isInitialized.asReadonly();
  readonly diagnosticSharingEnabled =
    this.#diagnosticSharingEnabled.asReadonly();
  readonly isEnabled = computed(() => {
    const config = this.#applicationConfiguration.postHogConfig();
    return config?.enabled ?? false;
  });

  /**
   * Signal bumped every time PostHog resolves or refreshes feature flags.
   * Used as a reactive dependency by `isFeatureEnabled()` consumers so that
   * `computed()` re-evaluates when the flag payload changes.
   */
  readonly flagsVersion = this.#flagsVersion.asReadonly();

  /**
   * Initialize PostHog with minimal configuration.
   * Leverages PostHog's built-in privacy defaults.
   */
  async initialize(): Promise<void> {
    if (!isPlatformBrowser(this.#platformId)) {
      this.#logger.debug('PostHog initialization skipped - not in browser');
      return;
    }

    const config = this.#applicationConfiguration.postHogConfig();

    if (!config?.enabled || !config.apiKey) {
      this.#logger.info('PostHog configuration disabled or missing API key');
      return;
    }

    try {
      this.#logger.info('Initializing PostHog', { host: config.host });

      expireLegacySharedCookie(config.apiKey);
      const posthog = (await import('posthog-js')).default;
      this.#posthog = posthog;
      this.#sessionReplayEnabled = config.sessionRecording?.enabled === true;

      posthog.init(config.apiKey, {
        api_host: config.host,
        ui_host: 'https://eu.posthog.com',
        debug: config.debug,

        // Privacy-first: anonymous events flow immediately, person profiles
        // only created after identify(). Full auto-capture enabled after auth.
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,

        // Session recording privacy relies on two mechanisms:
        //  - `maskAllInputs` redacts every form field value;
        //  - rendered amounts are plain text, so they are excluded through
        //    `ph-no-capture`, which posthog-js hardcodes as rrweb's
        //    `blockClass` — such elements are never serialized into a replay.
        // That class is therefore load-bearing for privacy, not only for the
        // "hide amounts" blur. See `.claude/rules/05-workflows-and-processes/
        // posthog-privacy.md` before renaming it.
        session_recording: {
          maskAllInputs: true,
          recordCrossOriginIframes: false,
          recordBody: false,
          recordHeaders: false,
          // posthog-js hashes the session ID, so the sampling decision remains
          // stable across page reloads for the whole session.
          sampleRate: config.sessionRecording?.sampleRate ?? 0.1,
          // PostHog also applies this callback to the page URL stored in replay
          // snapshots, not only to captured network requests.
          maskCapturedNetworkRequestFn: (request) => {
            const sanitizedRequest = { ...request };
            delete sanitizedRequest.requestHeaders;
            delete sanitizedRequest.responseHeaders;
            delete sanitizedRequest.requestBody;
            delete sanitizedRequest.responseBody;
            if (sanitizedRequest.name) {
              sanitizedRequest.name = sanitizeUrl(sanitizedRequest.name);
            }
            return sanitizedRequest;
          },
        },
        disable_session_recording: !this.#sessionReplayEnabled,

        // Built-in privacy protection
        person_profiles: 'identified_only',
        persistence: 'localStorage+cookie',
        persistence_name: POSTHOG_PERSISTENCE_NAME,
        cross_subdomain_cookie: false,

        // Sanitize financial data before sending
        before_send: this.#sanitizeEvent.bind(this),

        loaded: () => {
          this.#diagnosticSharingEnabled.set(
            !posthog.has_opted_out_capturing(),
          );
          this.#isInitialized.set(true);
          if (this.#diagnosticSharingEnabled()) {
            this.#registerGlobalProperties();
          }
          this.#logger.info('PostHog initialized successfully');
        },
      });

      posthog.onFeatureFlags(() => {
        this.#flagsVersion.update((v) => v + 1);
      });
    } catch (error) {
      this.#logger.error('Failed to initialize PostHog', error);
    }
  }

  /**
   * Returns true when the given feature flag is enabled for the current user.
   * Safe default: returns false before PostHog initializes or if the flag is
   * missing. Pair with `flagsVersion` signal in computeds for reactive gating.
   */
  isFeatureEnabled(key: string): boolean {
    const overrides = this.#readFlagOverrides();
    if (overrides && key in overrides) return overrides[key] === true;
    if (!this.#isInitialized() || !this.#diagnosticSharingEnabled()) {
      return false;
    }
    return this.#posthog?.isFeatureEnabled(key) === true;
  }

  setDiagnosticSharingEnabled(enabled: boolean): void {
    if (
      !isPlatformBrowser(this.#platformId) ||
      !this.#isInitialized() ||
      !this.isEnabled() ||
      enabled === this.#diagnosticSharingEnabled()
    ) {
      return;
    }

    try {
      if (enabled) {
        this.#posthog?.opt_in_capturing({ captureEventName: false });
        this.#diagnosticSharingEnabled.set(true);
        this.#isTrackingEnabled = false;
        this.#registerGlobalProperties();
        if (this.#sessionReplayEnabled) {
          this.#posthog?.startSessionRecording();
        }
      } else {
        this.#posthog?.stopSessionRecording();
        this.#posthog?.set_config({
          capture_pageview: false,
          capture_pageleave: false,
          autocapture: false,
        });
        this.#posthog?.reset(true);
        this.#posthog?.opt_out_capturing();
        this.#diagnosticSharingEnabled.set(false);
        this.#isTrackingEnabled = false;
      }
    } catch (error) {
      this.#logger.error('Failed to update diagnostic sharing', error);
    }
  }

  /**
   * Read feature-flag overrides, honored only in non-production environments.
   * Production and preview builds ignore them so no client-side script
   * (DevTools, browser extension) can flip flags.
   *
   * Two sources, merged (E2E global wins):
   * - `__E2E_POSTHOG_FLAGS__` global — set by the E2E harness before bootstrap.
   * - `pulpe-dev-feature-flags` in localStorage — manual dev toggle that
   *   survives reloads. Enable from the console:
   *   `localStorage.setItem('pulpe-dev-feature-flags','{"version":1,"data":{"example-flag":true},"updatedAt":""}')`
   *   then reload. Disable with `localStorage.removeItem('pulpe-dev-feature-flags')`.
   */
  #readFlagOverrides(): Record<string, boolean> | undefined {
    const env = this.#applicationConfiguration.environment();
    if (env !== 'test' && env !== 'local' && env !== 'development') {
      return undefined;
    }
    const e2eOverride = (
      globalThis as { __E2E_POSTHOG_FLAGS__?: Record<string, boolean> }
    ).__E2E_POSTHOG_FLAGS__;
    const devOverride =
      this.#storageService.get<Record<string, boolean>>(
        STORAGE_KEYS.DEV_FEATURE_FLAGS,
      ) ?? undefined;
    if (!e2eOverride && !devOverride) {
      return undefined;
    }
    return { ...devOverride, ...e2eOverride };
  }

  /**
   * Enable tracking after user consent
   */
  enableTracking(): void {
    if (!this.#canCapture() || this.#isTrackingEnabled) return;

    try {
      // Enable full tracking: SPA navigation, page leaves, and autocapture
      this.#posthog?.set_config({
        capture_pageview: 'history_change',
        capture_pageleave: 'if_capture_pageview',
        autocapture: true,
      });

      // Capture the initial pageview (subsequent navigations are auto-tracked)
      this.#posthog?.capture('$pageview');
      this.#isTrackingEnabled = true;
      this.#logger.info('PostHog tracking enabled with SPA navigation support');
    } catch (error) {
      this.#logger.error('Failed to enable tracking', error);
    }
  }

  /**
   * Capture event - PostHog handles data sanitization automatically
   */
  captureEvent(event: AnalyticsEventName, properties?: Properties): void {
    if (!this.#canCapture()) return;

    try {
      this.#posthog?.capture(event, properties);
      this.#logger.debug('PostHog event captured', { event });
    } catch (error) {
      this.#logger.error('Failed to capture event', error);
    }
  }

  /**
   * Capture exception using official PostHog method
   * PostHog automatically handles: timestamp, url, stack traces, fingerprinting, grouping
   */
  captureException(error: unknown, context?: Properties): void {
    if (!this.#canCapture()) return;

    try {
      this.#posthog?.captureException(error, {
        ...context,
        release: buildInfo.version,
        commit: buildInfo.shortCommitHash,
      });

      this.#logger.debug('PostHog exception captured');
    } catch (captureError) {
      this.#logger.error('Failed to capture exception', captureError);
    }
  }

  /**
   * Identify user
   */
  identify(userId: string, properties?: Properties): void {
    if (!this.#canCapture()) return;

    try {
      this.#posthog?.identify(userId, properties);
      this.#logger.debug('PostHog user identified', { userId });
    } catch (error) {
      this.#logger.error('Failed to identify user', error);
    }
  }

  /**
   * Set person properties (modern method)
   */
  setPersonProperties(
    properties?: Properties,
    propertiesOnce?: Properties,
  ): void {
    if (!this.#canCapture()) return;

    try {
      this.#posthog?.setPersonProperties(properties, propertiesOnce);
      this.#logger.debug('PostHog person properties set');
    } catch (error) {
      this.#logger.error('Failed to set person properties', error);
    }
  }

  /**
   * Store the pending OAuth signup method for cross-redirect tracking.
   */
  setPendingSignupMethod(method: string): void {
    this.#storageService.setString(
      STORAGE_KEYS.PENDING_SIGNUP_METHOD,
      method,
      'session',
    );
  }

  /**
   * Clear the pending OAuth signup method (cancelled/failed flow or email signup).
   */
  clearPendingSignupMethod(): void {
    this.#storageService.remove(STORAGE_KEYS.PENDING_SIGNUP_METHOD, 'session');
  }

  /**
   * Capture pending signup_completed event stored by OAuth redirect flow.
   * Called after user identification to link the event to the person profile.
   */
  capturePendingSignupCompleted(): void {
    if (!this.#canCapture()) return;

    const method = this.#storageService.getString(
      STORAGE_KEYS.PENDING_SIGNUP_METHOD,
      'session',
    );
    if (!method) return;

    this.clearPendingSignupMethod();
    this.captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, { method });
    this.#logger.debug('Pending signup_completed captured', { method });
  }

  /**
   * Reset state (e.g., on logout)
   *
   * posthog.reset() clears the distinct_id, device_id AND all registered
   * super properties. Re-register the global properties right after so that
   * subsequent anonymous events still carry platform/environment/app_version
   * for consistent filtering and cohort matching.
   */
  reset(): void {
    if (!this.#canCapture()) return;

    try {
      this.#posthog?.reset();
      this.#isTrackingEnabled = false;
      this.#registerGlobalProperties();
      this.#logger.debug('PostHog state reset');
    } catch (error) {
      this.#logger.error('Failed to reset PostHog', error);
    }
  }

  #canCapture(): boolean {
    return (
      isPlatformBrowser(this.#platformId) &&
      this.#isInitialized() &&
      this.isEnabled() &&
      this.#diagnosticSharingEnabled()
    );
  }

  #registerGlobalProperties(): void {
    try {
      const globalProperties = {
        environment: this.#applicationConfiguration.environment(),
        app_version: buildInfo.version,
        app_commit: buildInfo.shortCommitHash,
        platform: 'web',
      };

      this.#posthog?.register(globalProperties);
      this.#logger.info('PostHog global properties registered');

      // Use modern setPersonProperties instead of deprecated people.set_once
      this.setPersonProperties(undefined, {
        first_app_version: buildInfo.version,
        first_commit: buildInfo.shortCommitHash,
      });
    } catch (error) {
      this.#logger.error('Failed to register global properties', error);
    }
  }

  /**
   * Sanitize events to protect financial data
   */
  #sanitizeEvent(event: CaptureResult | null): CaptureResult | null {
    if (!event) return null;

    try {
      return sanitizeEventPayload(event);
    } catch (error) {
      this.#logger.error('Error sanitizing event', error);
      // Drop event on sanitization failure — data loss is preferable to financial data leakage
      return null;
    }
  }
}
