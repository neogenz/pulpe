import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PostHogService } from './posthog';
import { Logger } from '../logging/logger';

/**
 * Simplified global error handler following KISS principle.
 * Captures errors and sends them to PostHog for monitoring.
 */
@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandler implements ErrorHandler {
  readonly #postHogService = inject(PostHogService);
  readonly #logger = inject(Logger);

  handleError(error: unknown): void {
    // Always log to console for development
    console.error('[GlobalError]', error);

    // Extract meaningful error message
    const errorMessage = this.#extractMessage(error);
    const isHttpError = error instanceof HttpErrorResponse;

    // Log with our logger
    this.#logger.error(errorMessage, {
      isHttpError,
      status: isHttpError ? (error as HttpErrorResponse).status : undefined,
    });

    // Send to PostHog if available
    if (this.#postHogService.isInitialized()) {
      this.#postHogService.captureException(error, {
        message: errorMessage,
        isHttpError,
      });
    }
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
