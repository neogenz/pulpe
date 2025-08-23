import { Injectable, inject, signal, computed } from '@angular/core';
import posthog from 'posthog-js';
import type {
  PostHogEventProperties,
  PostHogUserProperties,
  PostHogEventName,
} from './posthog.types';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { Logger } from '@core/logging/logger';
import { buildInfo } from '@env/build-info';

/**
 * PostHog analytics service with fault tolerance and reactive state management.
 * Follows KISS principle with direct PostHog usage (no abstraction layer).
 * Compatible with Angular zoneless mode.
 */
@Injectable({
  providedIn: 'root',
})
export class PostHogService {
  readonly #config = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);

  // Reactive state using signals
  readonly #initialized = signal(false);
  readonly #initializationError = signal<Error | null>(null);

  // Public computed states for components to react to
  readonly isReady = computed(
    () => this.#initialized() && !this.#initializationError(),
  );
  readonly hasError = computed(() => !!this.#initializationError());

  constructor() {
    // Auto-capture page leave on window unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.isReady()) {
          try {
            posthog.capture('$pageleave');
          } catch {
            // Silent fail on page leave
          }
        }
      });
    }
  }

  /**
   * Initialize PostHog with fault tolerance.
   * Never throws - logs errors and continues without analytics.
   */
  async initialize(): Promise<void> {
    try {
      const posthogKey = this.#config.posthogApiKey?.();
      const posthogHost =
        this.#config.posthogApiHost?.() || 'https://app.posthog.com';
      const posthogEnabled = this.#config.posthogEnabled?.() ?? false;

      // Skip initialization if not enabled or no API key
      if (!posthogEnabled || !posthogKey) {
        this.#logger.info('PostHog analytics disabled or not configured');
        return;
      }

      // Initialize with timeout for fault tolerance
      await Promise.race([
        this.#initializePostHog(posthogKey, posthogHost),
        this.#timeout(5000), // 5 second timeout
      ]);

      this.#initialized.set(true);
      this.#logger.info('PostHog initialized successfully');
    } catch (error) {
      // Never throw - just log and mark as failed
      this.#initializationError.set(
        error instanceof Error ? error : new Error(String(error)),
      );
      this.#logger.warn(
        'PostHog initialization failed, continuing without analytics',
        error,
      );
    }
  }

  /**
   * Internal PostHog initialization
   */
  async #initializePostHog(apiKey: string, host: string): Promise<void> {
    return new Promise((resolve) => {
      posthog.init(apiKey, {
        api_host: host,
        loaded: (ph) => {
          // Register app metadata once
          ph.register_once({
            app_version: buildInfo.version,
            app_build: buildInfo.commitHash,
            app_environment: this.#config.environment(),
          });
          resolve();
        },
        // Privacy-first configuration
        autocapture: false, // Explicit tracking only
        capture_pageview: false, // Manual page view control
        capture_pageleave: true, // Automatic page leave
        disable_session_recording: this.#config.isDevelopment(), // No recording in dev
        // Performance settings
        bootstrap: {
          featureFlags: {}, // Will be populated via API if needed
        },
      });
    });
  }

  /**
   * Timeout helper for initialization
   */
  #timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`PostHog initialization timeout after ${ms}ms`)),
        ms,
      ),
    );
  }

  /**
   * Identify user with properties
   */
  identify(userId: string, properties?: PostHogUserProperties): void {
    if (!this.#checkReady('identify')) return;

    try {
      posthog.identify(userId, properties);
      this.#logger.debug('User identified in PostHog', { userId });
    } catch (error) {
      this.#logger.warn('Failed to identify user in PostHog', error);
    }
  }

  /**
   * Capture custom event with properties
   */
  capture(
    eventName: PostHogEventName | string,
    properties?: PostHogEventProperties,
  ): void {
    if (!this.#checkReady('capture')) return;

    try {
      posthog.capture(eventName, {
        ...properties,
        app_version: buildInfo.version,
        environment: this.#config.environment(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.#logger.warn(`Failed to capture event: ${eventName}`, error);
    }
  }

  /**
   * Capture exception with context
   */
  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.#checkReady('captureException')) return;

    try {
      posthog.capture('$exception', {
        $exception_message: error.message,
        $exception_stack_trace: error.stack,
        $exception_type: error.name,
        ...context,
        app_version: buildInfo.version,
        environment: this.#config.environment(),
        timestamp: new Date().toISOString(),
      });
    } catch (captureError) {
      this.#logger.warn('Failed to capture exception in PostHog', captureError);
    }
  }

  /**
   * Capture page view with properties
   */
  capturePageView(
    pageName: string,
    properties?: Record<string, unknown>,
  ): void {
    if (!this.#checkReady('capturePageView')) return;

    try {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
        $host: window.location.hostname,
        $pathname: window.location.pathname,
        page_name: pageName,
        ...properties,
      });
    } catch (error) {
      this.#logger.warn(`Failed to capture page view: ${pageName}`, error);
    }
  }

  /**
   * Set user context (identify or reset based on auth state)
   */
  setUser(user: { id: string; email?: string } | null): void {
    if (!this.#checkReady('setUser')) return;

    if (user) {
      this.identify(user.id, { email: user.email });
    } else {
      this.reset();
    }
  }

  /**
   * Reset user session (on logout)
   */
  reset(): void {
    if (!this.#checkReady('reset')) return;

    try {
      posthog.reset();
      this.#logger.debug('PostHog user session reset');
    } catch (error) {
      this.#logger.warn('Failed to reset PostHog session', error);
    }
  }

  /**
   * Get feature flag value
   */
  getFeatureFlag(flagName: string): boolean | string | undefined {
    if (!this.#checkReady('getFeatureFlag')) return undefined;

    try {
      return posthog.getFeatureFlag(flagName);
    } catch (error) {
      this.#logger.warn(`Failed to get feature flag: ${flagName}`, error);
      return undefined;
    }
  }

  /**
   * Check if PostHog is ready for operations
   */
  #checkReady(operation: string): boolean {
    if (!this.isReady()) {
      this.#logger.debug(`PostHog not ready for operation: ${operation}`);
      return false;
    }
    return true;
  }
}
