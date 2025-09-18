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
import {
  sanitizeFinancialString,
  deepSanitizeFinancialData,
  maskEmail,
  toJsonType,
  isSensitiveKey,
  isFinancialKey,
  getFinancialMaskSelectors,
} from './posthog-utils';

/**
 * PostHog service for analytics and error tracking integration.
 * Follows existing project patterns with signal-based reactive configuration,
 * environment-aware operation, and comprehensive security measures.
 */
@Injectable({
  providedIn: 'root',
})
export class PostHogService {
  readonly #applicationConfiguration = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);

  // Internal state
  readonly #isInitialized = signal<boolean>(false);
  readonly #initializationError = signal<string | null>(null);

  // Public computed signals
  readonly isInitialized = this.#isInitialized.asReadonly();
  readonly hasError = computed(() => this.#initializationError() !== null);
  readonly isEnabled = computed(() => {
    const config = this.#applicationConfiguration.postHogConfig();
    return config?.enabled ?? false;
  });

  readonly #platformId = inject(PLATFORM_ID);

  /**
   * Initialize PostHog with the current configuration.
   * This method is called during app initialization.
   */
  async initialize(): Promise<void> {
    if (!isPlatformBrowser(this.#platformId)) {
      this.#logger.debug(
        'PostHog initialization skipped - not in browser environment',
      );
      return;
    }

    const config = this.#applicationConfiguration.postHogConfig();

    if (!config) {
      this.#logger.info(
        'PostHog configuration not provided, skipping initialization',
      );
      return;
    }

    if (!config.apiKey) {
      this.#logger.warn(
        'PostHog API key not provided, skipping initialization',
      );
      return;
    }

    if (!config.enabled) {
      this.#logger.info('PostHog is disabled in configuration');
      return;
    }

    try {
      this.#logger.info('Initializing PostHog analytics service', {
        host: config.host,
        debug: config.debug,
        capturePageviews: config.capturePageviews,
      });

      await this.#initializePostHog(config);
      this.#isInitialized.set(true);
      this.#initializationError.set(null);

      this.#logger.info('PostHog initialized successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.#initializationError.set(errorMessage);
      this.#logger.error('Failed to initialize PostHog', error);

      // Don't throw - PostHog initialization failures shouldn't block app startup
    }
  }

  /**
   * Enable full tracking after user has accepted terms
   * Called after CGU acceptance during registration
   */
  enableTracking(): void {
    if (!this.#isInitialized()) {
      this.#logger.warn('Cannot enable tracking - PostHog not initialized');
      return;
    }

    try {
      posthog.opt_in_capturing();
      posthog.capture('$pageview');
      this.#logger.info('PostHog tracking enabled after terms acceptance');
    } catch (error) {
      this.#logger.error('Failed to enable PostHog tracking', error);
    }
  }

  /**
   * Capture an event with optional properties
   */
  capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.#canCapture()) {
      return;
    }

    try {
      const sanitizedProperties = this.#sanitizeProperties(properties);
      posthog.capture(event, sanitizedProperties);

      this.#logger.debug('PostHog event captured', {
        event,
        propertiesCount: Object.keys(sanitizedProperties || {}).length,
      });
    } catch (error) {
      this.#logger.error('Failed to capture PostHog event', error);
    }
  }

  /**
   * Capture an exception with contextual information
   */
  captureException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.#canCapture()) {
      return;
    }

    try {
      const sanitizedContext = this.#sanitizeProperties(context);
      const errorInfo = this.#extractErrorInfo(error);

      posthog.capture('$exception', {
        ...errorInfo,
        ...sanitizedContext,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        user_agent: navigator.userAgent,
        // Additional version info for error tracking
        release: buildInfo.version,
        commit: buildInfo.shortCommitHash,
        build_date: buildInfo.buildDate,
      });

      this.#logger.debug('PostHog exception captured', {
        errorMessage: errorInfo['error_message'],
        errorType: errorInfo['error_type'],
        release: buildInfo.version,
      });
    } catch (captureError) {
      this.#logger.error('Failed to capture PostHog exception', captureError);
    }
  }

  /**
   * Identify a user for PostHog tracking
   */
  identify(userId: string, properties?: Record<string, unknown>): void {
    if (!this.#canCapture()) {
      return;
    }

    try {
      const sanitizedProperties = this.#sanitizeProperties(properties);
      posthog.identify(userId, sanitizedProperties);

      this.#logger.debug('PostHog user identified', { userId });
    } catch (error) {
      this.#logger.error('Failed to identify PostHog user', error);
    }
  }

  /**
   * Reset PostHog state (e.g., on logout)
   */
  reset(): void {
    if (!this.#canCapture()) {
      return;
    }

    try {
      posthog.reset();
      this.#logger.debug('PostHog state reset');
    } catch (error) {
      this.#logger.error('Failed to reset PostHog state', error);
    }
  }

  /**
   * Initialize PostHog with configuration
   */
  #initializePostHog(config: {
    apiKey: string;
    host: string;
    enabled: boolean;
    capturePageviews: boolean;
    capturePageleaves: boolean;
    sessionRecording: {
      enabled: boolean;
      maskInputs: boolean;
      sampleRate: number;
    };
    debug: boolean;
  }): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const initPromise = Promise.race([
      // Init promise
      new Promise<void>((resolve) => {
        posthog.init(config.apiKey, {
          api_host: config.host,
          debug: config.debug,

          // Page tracking - DISABLED until user accepts terms
          capture_pageview: false, // Will be enabled after CGU acceptance
          capture_pageleave: false, // Will be enabled after CGU acceptance

          // Start with tracking disabled by default
          opt_out_capturing_by_default: true,

          // Session recording with financial data masking
          session_recording: {
            maskAllInputs: config.sessionRecording.maskInputs,
            maskTextSelector: getFinancialMaskSelectors(),
            maskTextFn: sanitizeFinancialString,
          },
          disable_session_recording: !config.sessionRecording.enabled,

          // Privacy and security
          person_profiles: 'identified_only',
          persistence: 'localStorage+cookie',

          // Data sanitization
          before_send: (event) => {
            if (!event) return null;

            const sanitizedProperties = deepSanitizeFinancialData(
              event.properties,
            );
            if (!sanitizedProperties) return null;

            return {
              ...event,
              properties: sanitizedProperties as Properties,
            };
          },

          // Error handling
          loaded: () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = undefined;
            }
            this.#logger.debug('PostHog loaded successfully');

            // Register global Super Properties for all PostHog events
            this.#registerGlobalProperties();

            resolve();
          },
        });
      }),

      // Timeout promise
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new Error('PostHog initialization timeout after 10 seconds'),
            ),
          10_000,
        );
      }),
    ]);

    // ✅ Cleanup guaranteed in all cases (success or failure)
    return initPromise.finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * Register global Super Properties that will be included with all PostHog events
   * Following PostHog best practices for environment and version tracking
   */
  #registerGlobalProperties(): void {
    try {
      const environment = this.#applicationConfiguration.environment();

      const globalProperties = {
        // Environment context
        environment: environment,

        // Application version info
        app_version: buildInfo.version,
        app_commit: buildInfo.shortCommitHash,
        deployment_date: buildInfo.buildDate,

        // Platform info
        platform: 'web',

        // Currency context (all amounts are CHF)
        default_currency: 'CHF',
      };

      posthog.register(globalProperties);

      this.#logger.info('PostHog Super Properties registered', {
        environment,
        app_version: buildInfo.version,
        properties_count: Object.keys(globalProperties).length,
      });

      // Set application version as a person property ($set_once to avoid overwriting)
      posthog.people.set_once({
        first_app_version: buildInfo.version,
        first_commit: buildInfo.shortCommitHash,
      });

      // Log financial data masking configuration if session recording is enabled
      const config = this.#applicationConfiguration.postHogConfig();
      if (config?.sessionRecording?.enabled) {
        this.#logger.info('PostHog financial data masking enabled', {
          maskInputs: config.sessionRecording.maskInputs,
          maskedSelectors:
            '.financial-amount, .financial-title, [class*="financial"], [class*="amount"]',
          patterns: [
            'CHF amounts',
            'Swiss number formatting',
            'Decimal amounts',
            'Percentages',
          ],
        });
      }
    } catch (error) {
      this.#logger.error('Failed to register PostHog Super Properties', error);
    }
  }

  /**
   * Check if PostHog can capture events
   */
  #canCapture(): boolean {
    if (!isPlatformBrowser(this.#platformId)) {
      return false;
    }

    if (!this.#isInitialized()) {
      this.#logger.debug('PostHog not initialized, skipping event capture');
      return false;
    }

    if (!this.isEnabled()) {
      return false;
    }

    return true;
  }

  /**
   * Extract error information from unknown error type
   */
  #extractErrorInfo(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        error_message: sanitizeFinancialString(error.message),
        error_name: error.name,
        error_stack: sanitizeFinancialString(error.stack || ''),
        error_type: 'Error',
      };
    }

    if (typeof error === 'string') {
      return {
        error_message: sanitizeFinancialString(error),
        error_type: 'string',
      };
    }

    return {
      error_message: 'Unknown error',
      error_type: typeof error,
      error_value: sanitizeFinancialString(String(error)),
    };
  }

  /**
   * Sanitize properties before sending to PostHog
   */
  #sanitizeProperties(properties?: Properties): Properties | undefined {
    if (!properties) {
      return undefined;
    }

    const sanitized: Properties = {};

    for (const [key, value] of Object.entries(properties)) {
      // Remove sensitive fields
      if (isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize email addresses
      if (key.toLowerCase().includes('email') && typeof value === 'string') {
        sanitized[key] = maskEmail(value);
        continue;
      }

      // Check for financial data in keys
      if (isFinancialKey(key)) {
        sanitized[key] = '***';
        continue;
      }

      // Deep sanitize the value for financial data
      sanitized[key] = deepSanitizeFinancialData(toJsonType(value));
    }

    return sanitized;
  }
}
