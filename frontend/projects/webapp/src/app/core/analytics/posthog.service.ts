import { Injectable, inject, signal, computed } from '@angular/core';
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

  // Lazy-loaded PostHog instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #posthogInstance: any = null;

  // Public computed states for components to react to
  readonly isReady = computed(
    () => this.#initialized() && !this.#initializationError(),
  );
  readonly hasError = computed(() => !!this.#initializationError());

  constructor() {
    // Auto-capture page leave on window unload - will be set up after initialization
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
      if (!posthogEnabled || !posthogKey || posthogKey.trim() === '') {
        this.#logger.info('PostHog analytics disabled or not configured');
        return;
      }

      // Only load PostHog library if we have a valid configuration
      await this.#loadPostHogLibrary();

      // Initialize with timeout for fault tolerance
      await Promise.race([
        this.#initializePostHog(posthogKey, posthogHost),
        this.#timeout(5000), // 5 second timeout
      ]);

      this.#initialized.set(true);
      this.#logger.info('PostHog initialized successfully');

      // Set up page leave handler after successful initialization
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          if (this.isReady() && this.#posthogInstance) {
            try {
              this.#posthogInstance.capture('$pageleave');
            } catch {
              // Silent fail on page leave
            }
          }
        });
      }
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
   * Load PostHog library dynamically
   */
  async #loadPostHogLibrary(): Promise<void> {
    // Import PostHog only when needed
    const { default: posthog } = await import('posthog-js');
    this.#posthogInstance = posthog;
  }

  /**
   * Internal PostHog initialization
   */
  async #initializePostHog(apiKey: string, host: string): Promise<void> {
    if (!this.#posthogInstance) {
      throw new Error('PostHog library not loaded');
    }

    return new Promise((resolve) => {
      this.#posthogInstance.init(apiKey, {
        api_host: host,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loaded: (ph: any) => {
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
      this.#posthogInstance.identify(userId, properties);
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
      this.#posthogInstance.capture(eventName, {
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
      this.#posthogInstance.capture('$exception', {
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
      this.#posthogInstance.capture('$pageview', {
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
      this.#posthogInstance.reset();
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
      return this.#posthogInstance.getFeatureFlag(flagName);
    } catch (error) {
      this.#logger.warn(`Failed to get feature flag: ${flagName}`, error);
      return undefined;
    }
  }

  /**
   * Check if PostHog is ready for operations
   */
  #checkReady(operation: string): boolean {
    if (!this.isReady() || !this.#posthogInstance) {
      this.#logger.debug(`PostHog not ready for operation: ${operation}`);
      return false;
    }
    return true;
  }
}
