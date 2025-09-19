import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';

/**
 * Global error handler following Angular best practices.
 * Leverages PostHog's built-in sanitization for security.
 */
@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandler implements ErrorHandler {
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);

  handleError(error: Error | HttpErrorResponse | unknown): void {
    // Extract meaningful error message for logging
    const errorMessage = this.#extractMessage(error);
    const isHttpError = error instanceof HttpErrorResponse;

    // Log locally for development
    this.#logger.error(`[GlobalError] ${errorMessage}`, error);

    // Send to PostHog (built-in sanitization handles security)
    this.#postHogService.captureException(error, {
      message: errorMessage,
      isHttpError,
    });
  }

  #extractMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return `HTTP ${error.status}: ${error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }
}

/**
 * Provider function for the global error handler
 */
export const provideGlobalErrorHandler = () => ({
  provide: ErrorHandler,
  useClass: GlobalErrorHandler,
});
