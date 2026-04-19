import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog, { type Properties, type CaptureResult } from 'posthog-js';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { buildInfo } from '@env/build-info';
import { sanitizeEventPayload } from './posthog-sanitizer';

const CROSS_DOMAIN_PARAM = 'ph_did';

/**
 * PostHog service for analytics and error tracking.
 * Uses PostHog's built-in privacy protection and minimal configuration.
 */
@Injectable({
  providedIn: 'root',
})
export class PostHogService {
  readonly #applicationConfiguration = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #platformId = inject(PLATFORM_ID);
  readonly #storageService = inject(StorageService);

  readonly #isInitialized = signal<boolean>(false);
  readonly #flagsVersion = signal<number>(0);
  #isTrackingEnabled = false;

  readonly isInitialized = this.#isInitialized.asReadonly();
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

      const crossDomainId = this.#extractCrossDomainId();

      posthog.init(config.apiKey, {
        api_host: config.host,
        ui_host: 'https://eu.posthog.com',
        debug: config.debug,

        // Cross-domain: use landing page distinct_id when available
        bootstrap: crossDomainId ? { distinctID: crossDomainId } : undefined,

        // Privacy-first: anonymous events flow immediately, person profiles
        // only created after identify(). Full auto-capture enabled after auth.
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,

        // Session recording with built-in privacy
        session_recording: {
          maskAllInputs: true, // PostHog handles financial data masking
          recordCrossOriginIframes: false,
        },
        disable_session_recording: !config.sessionRecording?.enabled,

        // Built-in privacy protection
        person_profiles: 'identified_only',
        persistence: 'localStorage+cookie',
        cross_subdomain_cookie: true,

        // Sanitize financial data before sending
        before_send: this.#sanitizeEvent.bind(this),

        loaded: () => {
          this.#registerGlobalProperties();
          this.#isInitialized.set(true);
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
    if (!this.#isInitialized()) return false;
    return posthog.isFeatureEnabled(key) === true;
  }

  /**
   * Enable tracking after user consent
   */
  enableTracking(): void {
    if (!this.#canCapture() || this.#isTrackingEnabled) return;

    try {
      // Enable full tracking: SPA navigation, page leaves, and autocapture
      posthog.set_config({
        capture_pageview: 'history_change',
        capture_pageleave: 'if_capture_pageview',
        autocapture: true,
      });

      // Capture the initial pageview (subsequent navigations are auto-tracked)
      posthog.capture('$pageview');
      this.#isTrackingEnabled = true;
      this.#logger.info('PostHog tracking enabled with SPA navigation support');
    } catch (error) {
      this.#logger.error('Failed to enable tracking', error);
    }
  }

  /**
   * Capture event - PostHog handles data sanitization automatically
   */
  captureEvent(event: string, properties?: Properties): void {
    if (!this.#canCapture()) return;

    try {
      posthog.capture(event, properties);
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
      posthog.captureException(error, {
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
      posthog.identify(userId, properties);
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
      posthog.setPersonProperties(properties, propertiesOnce);
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
    this.captureEvent('signup_completed', { method });
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
      posthog.reset();
      this.#isTrackingEnabled = false;
      this.#registerGlobalProperties();
      this.#logger.debug('PostHog state reset');
    } catch (error) {
      this.#logger.error('Failed to reset PostHog', error);
    }
  }

  /**
   * Extract cross-domain distinct_id from URL and clean up the param.
   * Used to link landing page (pulpe.app) sessions with webapp (app.pulpe.app).
   */
  #extractCrossDomainId(): string | null {
    const url = new URL(window.location.href);
    const distinctId = url.searchParams.get(CROSS_DOMAIN_PARAM);
    if (!distinctId) return null;

    url.searchParams.delete(CROSS_DOMAIN_PARAM);
    window.history.replaceState({}, '', url.toString());

    if (distinctId.length > 100 || !/^[\w-]+$/.test(distinctId)) {
      this.#logger.warn('Invalid cross-domain distinct_id format, ignoring');
      return null;
    }

    this.#logger.info('Cross-domain distinct_id received from landing');
    return distinctId;
  }

  #canCapture(): boolean {
    return (
      isPlatformBrowser(this.#platformId) &&
      this.#isInitialized() &&
      this.isEnabled()
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

      posthog.register(globalProperties);
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
