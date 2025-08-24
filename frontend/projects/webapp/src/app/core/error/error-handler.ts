import { type ErrorHandler, Injectable, inject } from '@angular/core';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics';
import { environment } from '@env/environment';

/**
 * ErrorHandler minimal pour les erreurs non gérées
 * Logger les erreurs et déléguer à PostHog si disponible
 * Suit le principe KISS avec séparation des responsabilités
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  readonly #logger = inject(Logger);
  readonly #posthog = inject(PostHogService);

  handleError(error: unknown): void {
    const err = this.#normalizeError(error);

    // Always log locally first (primary responsibility)
    this.#logger.error('Unhandled error', err);

    // Delegate to PostHog if available (secondary responsibility)
    if (this.#posthog.isReady()) {
      this.#captureErrorToPostHog(err);
    }

    // Dev console output for debugging
    if (!environment.production) {
      console.error('Unhandled error:', err);
    }
  }

  /**
   * Normalize various error types to Error instance
   */
  #normalizeError(error: unknown): Error {
    // Already an Error instance
    if (error instanceof Error) {
      return error;
    }

    // String error
    if (typeof error === 'string') {
      return new Error(error);
    }

    // Angular/RxJS rejection event
    if (
      error &&
      typeof error === 'object' &&
      'rejection' in error &&
      (error as Record<string, unknown>)['rejection']
    ) {
      return this.#normalizeError(
        (error as Record<string, unknown>)['rejection'],
      );
    }

    // Angular zone error wrapper
    if (
      error &&
      typeof error === 'object' &&
      'ngOriginalError' in error &&
      (error as Record<string, unknown>)['ngOriginalError']
    ) {
      return this.#normalizeError(
        (error as Record<string, unknown>)['ngOriginalError'],
      );
    }

    // Unknown error type - convert to string
    return new Error(String(error));
  }

  /**
   * Capture error to PostHog with contextual information
   */
  #captureErrorToPostHog(error: Error): void {
    try {
      this.#posthog.captureException(error, {
        source: 'unhandled',
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        environment: environment.production ? 'production' : 'development',
      });
    } catch (captureError) {
      // Silent fail - don't let analytics errors affect the app
      this.#logger.debug('Failed to capture error to PostHog', captureError);
    }
  }
}
