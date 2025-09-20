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
    if (!this.#canCapture()) return;

    try {
      posthog.opt_in_capturing();

      // Enable automatic pageview and pageleave tracking for web analytics
      posthog.set_config({
        capture_pageview: true,
        capture_pageleave: true,
      });

      // Capture the initial pageview
      posthog.capture('$pageview');
      this.#logger.info('PostHog tracking enabled with web analytics');
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
   * Capture exception using official PostHog method
   * PostHog automatically handles: timestamp, url, stack traces, fingerprinting, grouping
   */
  captureException(error: unknown, context?: Properties): void {
    if (!this.#canCapture()) return;

    try {
      // Use official PostHog method - handles all error processing automatically
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

      // Use modern setPersonProperties instead of deprecated people.set_once
      this.setPersonProperties(undefined, {
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

  /**
   * Sanitize events to protect financial data
   */
  #sanitizeEvent(event: CaptureResult | null): CaptureResult | null {
    if (!event) return null;

    try {
      // Sanitize URLs containing sensitive IDs
      const sanitizeUrl = (url: string): string => {
        if (typeof url !== 'string') return url;

        return (
          url
            // Sanitize budget IDs
            .replace(/\/budgets?\/[a-zA-Z0-9-]+/gi, '/budget/[id]')
            // Sanitize transaction IDs
            .replace(/\/transactions?\/[a-zA-Z0-9-]+/gi, '/transaction/[id]')
            // Sanitize template IDs
            .replace(/\/templates?\/[a-zA-Z0-9-]+/gi, '/template/[id]')
            // Sanitize numeric IDs in paths
            .replace(/\/\d{4,}/g, '/[id]')
        );
      };

      // Sanitize properties recursively
      const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
          return obj.map((item) =>
            typeof item === 'object' && item !== null
              ? sanitizeObject(item)
              : item,
          ) as unknown as T;
        }

        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          // Skip sensitive financial properties
          if (
            key.match(
              /^(amount|balance|total|budget|transaction|income|expense|saving|credit|debit|price|cost|value|sum|money)/i,
            )
          ) {
            // Mask financial values
            result[key] = '[REDACTED]';
          } else if (key.includes('url') || key.includes('href')) {
            // Sanitize URLs
            result[key] =
              typeof value === 'string' ? sanitizeUrl(value) : value;
          } else if (typeof value === 'object' && value !== null) {
            // Recursively sanitize nested objects
            result[key] = sanitizeObject(value as Record<string, unknown>);
          } else {
            result[key] = value;
          }
        }
        return result as T;
      };

      // Sanitize event properties
      if (event.properties) {
        // Special handling for current URL
        if (event.properties['$current_url']) {
          event.properties['$current_url'] = sanitizeUrl(
            event.properties['$current_url'] as string,
          );
        }
        // Sanitize all other properties
        event.properties = sanitizeObject(
          event.properties as Record<string, unknown>,
        ) as Properties;
      }

      // Sanitize $set properties
      if (event.$set) {
        event.$set = sanitizeObject(
          event.$set as Record<string, unknown>,
        ) as Properties;
      }

      // Sanitize $set_once properties
      if (event.$set_once) {
        event.$set_once = sanitizeObject(
          event.$set_once as Record<string, unknown>,
        ) as Properties;
      }

      return event;
    } catch (error) {
      this.#logger.error('Error sanitizing event', error);
      // Return event as-is if sanitization fails to avoid data loss
      return event;
    }
  }
}
