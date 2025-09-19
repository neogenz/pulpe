import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog, { type Properties } from 'posthog-js';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { buildInfo } from '@env/build-info';

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
        debug: config.debug,

        // Privacy-first configuration
        capture_pageview: false, // Enable after user consent
        capture_pageleave: false,
        opt_out_capturing_by_default: true,

        // Session recording with built-in privacy
        session_recording: {
          maskAllInputs: true, // PostHog handles financial data masking
          recordCrossOriginIframes: false,
        },
        disable_session_recording: !config.sessionRecording?.enabled,

        // Built-in privacy protection
        person_profiles: 'identified_only',
        persistence: 'localStorage+cookie',

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
    if (!this.#canCapture()) return;

    try {
      posthog.opt_in_capturing();
      posthog.capture('$pageview');
      this.#logger.info('PostHog tracking enabled');
    } catch (error) {
      this.#logger.error('Failed to enable tracking', error);
    }
  }

  /**
   * Capture event - PostHog handles data sanitization automatically
   */
  capture(event: string, properties?: Properties): void {
    if (!this.#canCapture()) return;

    try {
      posthog.capture(event, properties);
      this.#logger.debug('PostHog event captured', { event });
    } catch (error) {
      this.#logger.error('Failed to capture event', error);
    }
  }

  /**
   * Capture exception - PostHog handles sanitization automatically
   */
  captureException(error: unknown, context?: Properties): void {
    if (!this.#canCapture()) return;

    try {
      const errorInfo = this.#extractErrorInfo(error);

      posthog.capture('$exception', {
        ...errorInfo,
        ...context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
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
   * Reset state (e.g., on logout)
   */
  reset(): void {
    if (!this.#canCapture()) return;

    try {
      posthog.reset();
      this.#logger.debug('PostHog state reset');
    } catch (error) {
      this.#logger.error('Failed to reset PostHog', error);
    }
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

      posthog.people.set_once({
        first_app_version: buildInfo.version,
        first_commit: buildInfo.shortCommitHash,
      });
    } catch (error) {
      this.#logger.error('Failed to register global properties', error);
    }
  }

  #canCapture(): boolean {
    return (
      isPlatformBrowser(this.#platformId) &&
      this.#isInitialized() &&
      this.isEnabled()
    );
  }

  #extractErrorInfo(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        error_message: error.message,
        error_name: error.name,
        error_stack: error.stack || '',
        error_type: 'Error',
      };
    }

    if (typeof error === 'string') {
      return {
        error_message: error,
        error_type: 'string',
      };
    }

    return {
      error_message: 'Unknown error',
      error_type: typeof error,
      error_value: String(error),
    };
  }
}
