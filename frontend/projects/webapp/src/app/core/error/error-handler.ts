import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Logger } from '@core/logging/logger';
import {
  type PulpeError,
  createPulpeError,
  isHttpError,
  ErrorCategory,
} from './error-types';

// Zone.js types - safely check if available
declare const Zone: {
  current?: {
    get(key: string): unknown;
  };
};

/**
 * Custom error handler for the Pulpe application
 * Follows Angular 20 best practices and KISS principle
 *
 * Responsibilities:
 * - Categorize and structure errors
 * - Log errors appropriately
 * - Store error history for debugging
 * - Handle Zone.js unwrapping
 */
@Injectable()
export class PulpeErrorHandler implements ErrorHandler {
  readonly #logger = inject(Logger);
  readonly #errorHistory: PulpeError[] = [];
  readonly #maxHistorySize = 50;

  /**
   * Handle error thrown anywhere in the application
   * This is called by Angular when an error is not caught
   */
  handleError(error: unknown): void {
    // Unwrap Zone.js error if present
    const unwrappedError = this.#unwrapError(error);

    // Create structured error
    const pulpeError = createPulpeError(unwrappedError);

    // Store in history
    this.#addToHistory(pulpeError);

    // Log based on category
    this.#logError(pulpeError);

    // In development, also log to console for debugging
    if (!this.#isProduction()) {
      console.error('Unhandled error:', pulpeError);
    }
  }

  /**
   * Get error history for debugging
   */
  getErrorHistory(): readonly PulpeError[] {
    return [...this.#errorHistory];
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.#errorHistory.length = 0;
  }

  /**
   * Get last error
   */
  getLastError(): PulpeError | undefined {
    return this.#errorHistory[this.#errorHistory.length - 1];
  }

  /**
   * Unwrap error from Zone.js if present
   */
  #unwrapError(error: unknown): unknown {
    // Check if Zone.js is present and unwrap if needed
    if (error && typeof error === 'object' && 'ngOriginalError' in error) {
      return (error as { ngOriginalError: unknown }).ngOriginalError;
    }

    // Also check for rejection property (for promise rejections)
    if (error && typeof error === 'object' && 'rejection' in error) {
      return (error as { rejection: unknown }).rejection;
    }

    return error;
  }

  /**
   * Add error to history with size limit
   */
  #addToHistory(error: PulpeError): void {
    this.#errorHistory.push(error);

    // Keep history size under control
    if (this.#errorHistory.length > this.#maxHistorySize) {
      this.#errorHistory.shift();
    }
  }

  /**
   * Log error based on its category and severity
   */
  #logError(error: PulpeError): void {
    const logContext = {
      category: error.category,
      code: error.code,
      context: error.context,
      timestamp: error.timestamp,
      retryable: error.retryable,
    };

    switch (error.category) {
      case ErrorCategory.NETWORK:
        this.#handleNetworkError(error, logContext);
        break;

      case ErrorCategory.VALIDATION:
        this.#handleValidationError(error, logContext);
        break;

      case ErrorCategory.BUSINESS:
        this.#handleBusinessError(error, logContext);
        break;

      case ErrorCategory.SYSTEM:
        this.#handleSystemError(error, logContext);
        break;

      case ErrorCategory.UNKNOWN:
      default:
        this.#handleUnknownError(error, logContext);
        break;
    }
  }

  /**
   * Handle network errors
   */
  #handleNetworkError(
    error: PulpeError,
    context: Record<string, unknown>,
  ): void {
    if (isHttpError(error.originalError) && error.originalError.status === 0) {
      // Offline or CORS error
      this.#logger.warn('Network connectivity issue detected', context);
    } else {
      this.#logger.error('Network error occurred', {
        ...context,
        message: error.message,
      });
    }
  }

  /**
   * Handle validation errors
   */
  #handleValidationError(
    error: PulpeError,
    context: Record<string, unknown>,
  ): void {
    this.#logger.warn('Validation error', {
      ...context,
      message: error.message,
    });
  }

  /**
   * Handle business logic errors
   */
  #handleBusinessError(
    error: PulpeError,
    context: Record<string, unknown>,
  ): void {
    this.#logger.warn('Business rule violation', {
      ...context,
      message: error.message,
    });
  }

  /**
   * Handle system errors
   */
  #handleSystemError(
    error: PulpeError,
    context: Record<string, unknown>,
  ): void {
    this.#logger.error('System error occurred', {
      ...context,
      message: error.message,
      stack: error.stack,
    });
  }

  /**
   * Handle unknown errors
   */
  #handleUnknownError(
    error: PulpeError,
    context: Record<string, unknown>,
  ): void {
    this.#logger.error('Unknown error occurred', {
      ...context,
      message: error.message,
      stack: error.stack,
      originalError: error.originalError,
    });
  }

  /**
   * Check if running in production
   */
  #isProduction(): boolean {
    // Check for production mode
    // ngDevMode is either undefined or an object with counters in dev mode
    const isDev = typeof ngDevMode !== 'undefined' && ngDevMode !== null;
    return (
      !isDev || (typeof Zone !== 'undefined' && !Zone.current?.get('isDevMode'))
    );
  }
}

// Export a factory function for providing the error handler
export function providePulpeErrorHandler() {
  return {
    provide: ErrorHandler,
    useClass: PulpeErrorHandler,
  };
}
