import { type ErrorHandler, Injectable, inject } from '@angular/core';
import { Logger } from '@core/logging/logger';
import { environment } from '@env/environment';

/**
 * ErrorHandler minimal pour les erreurs non gérées
 * Logger les erreurs uniquement - PostHog sera géré séparément si nécessaire
 * Suit le principe KISS avec une seule responsabilité
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  readonly #logger = inject(Logger);

  handleError(error: unknown): void {
    const err = this.#normalizeError(error);

    // Always log locally first (primary responsibility)
    this.#logger.error('Unhandled error', err);

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
}
