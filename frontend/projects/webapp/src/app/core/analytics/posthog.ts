import {
  Service,
  PLATFORM_ID,
  inject,
  signal,
  computed,
  type OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import type { Subscription } from 'rxjs';
import type {
  CaptureOptions,
  CaptureResult,
  PostHog,
  Properties,
} from 'posthog-js';
import { ANALYTICS_EVENTS, type AnalyticsEventName } from 'pulpe-shared';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { buildInfo } from '@env/build-info';
import {
  AUTOCAPTURE_TAG_PATTERN,
  MAX_AUTOCAPTURE_ELEMENTS,
  sanitizeEventPayload,
  sanitizePersonProperties,
  sanitizeRecord,
  sanitizeUrl,
} from './posthog-sanitizer';

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
export class PostHogService implements OnDestroy {
  readonly #applicationConfiguration = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #platformId = inject(PLATFORM_ID);
  readonly #storageService = inject(StorageService);
  readonly #router = inject(Router);

  #posthog: PostHog | null = null;
  readonly #isInitialized = signal<boolean>(false);
  readonly #flagsVersion = signal<number>(0);
  readonly #diagnosticSharingEnabled = signal(true);
  #isTrackingEnabled = false;
  #resumeTrackingAfterOptIn = false;
  #sessionReplayEnabled = false;
  #autocaptureClickListener?: (event: MouseEvent) => void;
  #navigationSubscription?: Subscription;

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
      this.#sessionReplayEnabled = config.sessionRecording.enabled;

      posthog.init(config.apiKey, {
        api_host: config.host,
        ui_host: 'https://eu.posthog.com',
        debug: config.debug,

        // Privacy-first: anonymous events flow immediately, person profiles
        // only exist after identify(). Autocapture is disabled until the
        // authenticated tracking lifecycle enables click-only collection.
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        mask_all_text: true,
        mask_all_element_attributes: true,
        rageclick: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        enable_recording_console_log: false,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        strict_script_versioning: true,
        save_campaign_params: false,
        save_referrer: false,

        // Keep product copy and layout visible for support. Inputs are masked,
        // sensitive DOM subtrees use PostHog's native `ph-no-capture` block,
        // and replay URLs are sanitized before leaving the browser. See
        // `.claude/rules/05-workflows-and-processes/posthog-privacy.md`.
        session_recording: {
          maskAllInputs: true,
          inlineStylesheet: true,
          collectFonts: false,
          slimDOMOptions: 'all',
          captureCanvas: { recordCanvas: false },
          recordCrossOriginIframes: false,
          recordBody: false,
          recordHeaders: false,
          // posthog-js hashes the session ID, so the sampling decision remains
          // stable across page reloads for the whole session.
          sampleRate: config.sessionRecording.sampleRate,
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

        // Sanitize application events; PostHog replay internals stay opaque.
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
        if (this.#resumeTrackingAfterOptIn) {
          this.enableTracking();
        }
      } else {
        this.#resumeTrackingAfterOptIn = this.#isTrackingEnabled;
        this.#stopSanitizedAutocapture();
        this.#stopNavigationTracking();
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
    if (this.#isTrackingEnabled) return;
    if (!this.#canCapture()) {
      if (
        this.#isInitialized() &&
        this.isEnabled() &&
        !this.#diagnosticSharingEnabled()
      ) {
        this.#resumeTrackingAfterOptIn = true;
      }
      return;
    }

    try {
      // Keep SDK pageview capture disabled: posthog-js 1.364.4 does not install
      // HistoryAutocapture when this option is enabled after initialization.
      // Pulpe owns Angular NavigationEnd tracking after authentication instead.
      this.#posthog?.set_config({
        capture_pageview: false,
        // The unload listener is installed during SDK initialization and reads
        // this flag dynamically, independently from HistoryAutocapture.
        capture_pageleave:
          this.#applicationConfiguration.postHogConfig()?.capturePageleaves ===
          true,
        // Native autocapture reads special DOM attributes before before_send.
        // Pulpe emits the same event from a structure-only listener instead.
        autocapture: false,
      });
      this.#startSanitizedAutocapture();
      this.#startNavigationTracking();

      // Catch up only when Angular already completed a navigation. During cold
      // bootstrap, the first NavigationEnd below is the authoritative pageview.
      if (this.#router.navigated) {
        this.#posthog?.capture('$pageview');
      }
      this.#isTrackingEnabled = true;
      this.#logger.info('PostHog tracking enabled with SPA navigation support');
    } catch (error) {
      this.#logger.error('Failed to enable tracking', error);
    }
  }

  #startSanitizedAutocapture(): void {
    if (this.#autocaptureClickListener) return;

    this.#autocaptureClickListener = (event: MouseEvent) => {
      if (!this.#canCapture()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const elements: Record<string, unknown>[] = [];
      const chain: string[] = [];
      let current: Element | null = target;
      while (
        current &&
        current !== document.body &&
        elements.length < MAX_AUTOCAPTURE_ELEMENTS
      ) {
        if (current.classList.contains('ph-no-capture')) return;
        const tagName = current.localName.toLowerCase();
        if (!AUTOCAPTURE_TAG_PATTERN.test(tagName)) return;

        let nthChild = 1;
        let nthOfType = 1;
        for (
          let sibling = current.previousElementSibling;
          sibling;
          sibling = sibling.previousElementSibling
        ) {
          nthChild += 1;
          if (sibling.localName.toLowerCase() === tagName) nthOfType += 1;
        }

        elements.push({
          tag_name: tagName,
          nth_child: nthChild,
          nth_of_type: nthOfType,
        });
        chain.push(
          `${tagName}:nth-child="${nthChild}"nth-of-type="${nthOfType}"`,
        );
        current = current.parentElement;
      }

      if (elements.length === 0 || current !== document.body) return;
      this.#posthog?.capture('$autocapture', {
        $event_type: 'click',
        $ce_version: 1,
        $elements: elements,
        $elements_chain: chain.join(';'),
      });
    };

    document.addEventListener('click', this.#autocaptureClickListener, {
      capture: true,
    });
  }

  #stopSanitizedAutocapture(): void {
    if (!this.#autocaptureClickListener) return;
    document.removeEventListener('click', this.#autocaptureClickListener, {
      capture: true,
    });
    this.#autocaptureClickListener = undefined;
  }

  #startNavigationTracking(): void {
    if (this.#navigationSubscription) return;

    this.#navigationSubscription = this.#router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.#canCapture()) {
        this.#posthog?.capture('$pageview');
      }
    });
  }

  #stopNavigationTracking(): void {
    this.#navigationSubscription?.unsubscribe();
    this.#navigationSubscription = undefined;
  }

  /**
   * Capture an explicitly designed business event. Sanitize before invoking
   * PostHog because `$set` fields mutate feature-flag person state before the
   * SDK's `before_send` hook runs.
   *
   * `options` reaches posthog-js untouched. The one that matters here is
   * `send_instantly`, for an event fired right before the page goes away: the
   * batched queue would never get its turn.
   */
  captureEvent(
    event: AnalyticsEventName,
    properties?: Properties,
    options?: CaptureOptions,
  ): void {
    if (!this.#canCapture()) return;

    try {
      const sanitizedProperties = properties
        ? sanitizeRecord(properties as Record<string, unknown>)
        : undefined;
      if (sanitizedProperties) {
        delete sanitizedProperties['$set'];
        delete sanitizedProperties['$set_once'];
      }
      this.#posthog?.capture(event, sanitizedProperties, options);
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
      const sanitizedContext = context
        ? sanitizeRecord(context as Record<string, unknown>)
        : {};
      delete sanitizedContext['$set'];
      delete sanitizedContext['$set_once'];
      this.#posthog?.captureException(error, {
        ...sanitizedContext,
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
      const sanitizedProperties = properties
        ? sanitizePersonProperties(properties as Record<string, unknown>)
        : undefined;
      this.#posthog?.identify(userId, sanitizedProperties);
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
      const sanitizedProperties = properties
        ? sanitizePersonProperties(properties as Record<string, unknown>)
        : undefined;
      const sanitizedPropertiesOnce = propertiesOnce
        ? sanitizeRecord(propertiesOnce as Record<string, unknown>)
        : undefined;
      this.#posthog?.setPersonProperties(
        sanitizedProperties,
        sanitizedPropertiesOnce,
      );
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
      this.#stopSanitizedAutocapture();
      this.#stopNavigationTracking();
      this.#posthog?.reset();
      this.#isTrackingEnabled = false;
      this.#resumeTrackingAfterOptIn = false;
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

  ngOnDestroy(): void {
    this.#stopSanitizedAutocapture();
    this.#stopNavigationTracking();
  }

  /** Sanitize application events while preserving PostHog internals. */
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
