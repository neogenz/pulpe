import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';
import { ApiError } from '../api/api-error';

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
    const errorMessage = this.#extractMessage(error);
    this.#logger.error(`[GlobalError] ${errorMessage}`, error);

    // HTTP errors already captured by httpErrorInterceptor — don't double-capture
    if (error instanceof HttpErrorResponse) {
      return;
    }

    // ApiError wrapping an HTTP response is already captured — skip only those
    if (error instanceof ApiError && error.status > 0) {
      return;
    }

    // Only capture JS runtime errors (null refs, type errors, uncaught exceptions)
    this.#postHogService.captureException(error);
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
