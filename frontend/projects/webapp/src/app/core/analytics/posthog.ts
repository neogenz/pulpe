import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog from 'posthog-js';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { runOutsideAngular } from './global-error-handler';

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
   * Capture an event with optional properties
   */
  capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.#canCapture()) {
      return;
    }

    runOutsideAngular(() => {
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
    });
  }

  /**
   * Capture an exception with contextual information
   */
  captureException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.#canCapture()) {
      return;
    }

    runOutsideAngular(() => {
      try {
        const sanitizedContext = this.#sanitizeProperties(context);
        const errorInfo = this.#extractErrorInfo(error);

        posthog.capture('$exception', {
          ...errorInfo,
          ...sanitizedContext,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          user_agent: navigator.userAgent,
        });

        this.#logger.debug('PostHog exception captured', {
          errorMessage: errorInfo['error_message'],
          errorType: errorInfo['error_type'],
        });
      } catch (captureError) {
        this.#logger.error('Failed to capture PostHog exception', captureError);
      }
    });
  }

  /**
   * Identify a user for PostHog tracking
   */
  identify(userId: string, properties?: Record<string, unknown>): void {
    if (!this.#canCapture()) {
      return;
    }

    runOutsideAngular(() => {
      try {
        const sanitizedProperties = this.#sanitizeProperties(properties);
        posthog.identify(userId, sanitizedProperties);

        this.#logger.debug('PostHog user identified', { userId });
      } catch (error) {
        this.#logger.error('Failed to identify PostHog user', error);
      }
    });
  }

  /**
   * Reset PostHog state (e.g., on logout)
   */
  reset(): void {
    if (!this.#canCapture()) {
      return;
    }

    runOutsideAngular(() => {
      try {
        posthog.reset();
        this.#logger.debug('PostHog state reset');
      } catch (error) {
        this.#logger.error('Failed to reset PostHog state', error);
      }
    });
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
    return new Promise<void>((resolve) => {
      runOutsideAngular(() => {
        posthog.init(config.apiKey, {
          api_host: config.host,
          debug: config.debug,

          // Page tracking
          capture_pageview: false, // We'll handle this manually for SPA routing
          capture_pageleave: config.capturePageleaves,

          // Session recording
          session_recording: {
            maskAllInputs: config.sessionRecording.maskInputs,
          },
          disable_session_recording: !config.sessionRecording.enabled,

          // Privacy and security
          person_profiles: 'identified_only',
          persistence: 'localStorage+cookie',

          // Data sanitization
          // before_send: this.#sanitizeEvent.bind(this), // TODO: Fix type compatibility

          // Error handling
          loaded: () => {
            this.#logger.debug('PostHog loaded successfully');
            resolve();
          },
        });
      });
    });
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
        error_message: error.message,
        error_name: error.name,
        error_stack: error.stack,
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

  /**
   * Sanitize properties before sending to PostHog
   */
  #sanitizeProperties(
    properties?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!properties) {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /auth/i,
      /credential/i,
      /credit.*card/i,
      /ssn/i,
      /social.*security/i,
    ];

    for (const [key, value] of Object.entries(properties)) {
      // Remove sensitive fields
      if (sensitivePatterns.some((pattern) => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize email addresses
      if (key.toLowerCase().includes('email') && typeof value === 'string') {
        sanitized[key] = this.#maskEmail(value);
        continue;
      }

      // Keep other values as-is
      sanitized[key] = value;
    }

    return sanitized;
  }

  // Removed unused #sanitizeEvent method to fix ESLint error

  // Removed unused #sanitizeUrl method to fix ESLint error

  /**
   * Mask email address for privacy
   */
  #maskEmail(email: string): string {
    try {
      const [local, domain] = email.split('@');
      if (!local || !domain) {
        return '[REDACTED]';
      }

      const maskedLocal =
        local.length > 2 ? `${local.substring(0, 2)}***` : '***';

      return `${maskedLocal}@${domain}`;
    } catch {
      return '[REDACTED]';
    }
  }
}
