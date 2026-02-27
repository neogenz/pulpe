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
import { buildInfo } from '@env/build-info';
import { sanitizeEventPayload } from './posthog-sanitizer';

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

  readonly #isInitialized = signal<boolean>(false);
  #isTrackingEnabled = false;

  readonly isInitialized = this.#isInitialized.asReadonly();
  readonly isEnabled = computed(() => {
    const config = this.#applicationConfiguration.postHogConfig();
    return config?.enabled ?? false;
  });

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

      posthog.init(config.apiKey, {
        api_host: config.host,
        ui_host: 'https://eu.posthog.com',
        debug: config.debug,

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

        // Sanitize financial data before sending
        before_send: this.#sanitizeEvent.bind(this),

        loaded: () => {
          this.#registerGlobalProperties();
          this.#isInitialized.set(true);
          this.#logger.info('PostHog initialized successfully');
        },
      });
    } catch (error) {
      this.#logger.error('Failed to initialize PostHog', error);
    }
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
   * Capture pending signup_completed event stored by OAuth redirect flow.
   * Called after user identification to link the event to the person profile.
   */
  capturePendingSignupCompleted(): void {
    if (!this.#canCapture()) return;

    const STORAGE_KEY = 'pulpe_pending_signup_method';
    const method = sessionStorage.getItem(STORAGE_KEY);
    if (!method) return;

    sessionStorage.removeItem(STORAGE_KEY);
    this.captureEvent('signup_completed', { method });
    this.#logger.debug('Pending signup_completed captured', { method });
  }

  /**
   * Reset state (e.g., on logout)
   */
  reset(): void {
    if (!this.#canCapture()) return;

    try {
      posthog.reset();
      this.#isTrackingEnabled = false;
      this.#logger.debug('PostHog state reset');
    } catch (error) {
      this.#logger.error('Failed to reset PostHog', error);
    }
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
      // Return event as-is if sanitization fails to avoid data loss
      return event;
    }
  }
}
