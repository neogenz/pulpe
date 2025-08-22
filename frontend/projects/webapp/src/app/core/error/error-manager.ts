import { Injectable, inject, signal, computed } from '@angular/core';
import { ErrorHandler } from '@angular/core';
import { Logger } from '@core/logging/logger';
import {
  type PulpeError,
  createPulpeError,
  ErrorCategory,
  isRetryableError,
} from './error-types';
import { PulpeErrorHandler } from './error-handler';

/**
 * Central service for proactive error management
 * Provides reactive state and methods for error handling throughout the app
 *
 * This service complements the ErrorHandler by providing:
 * - Reactive error state with signals
 * - Methods to manually report errors
 * - Error filtering and querying
 * - Integration with retry mechanisms
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorManager {
  readonly #errorHandler = inject(ErrorHandler);
  readonly #logger = inject(Logger);

  // Reactive state
  readonly #currentError = signal<PulpeError | null>(null);
  readonly #errorQueue = signal<PulpeError[]>([]);
  readonly #isProcessingError = signal(false);

  // Public selectors
  readonly currentError = this.#currentError.asReadonly();
  readonly errorQueue = this.#errorQueue.asReadonly();
  readonly isProcessingError = this.#isProcessingError.asReadonly();

  /**
   * Check if there's an active error
   */
  readonly hasError = computed(() => this.#currentError() !== null);

  /**
   * Check if current error is retryable
   */
  readonly canRetry = computed(() => {
    const error = this.#currentError();
    return error?.retryable ?? false;
  });

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): PulpeError[] {
    if (this.#errorHandler instanceof PulpeErrorHandler) {
      return this.#errorHandler
        .getErrorHistory()
        .filter((error) => error.category === category);
    }
    return [];
  }

  /**
   * Report an error manually
   * Use this when you want to handle an error but still track it
   */
  reportError(error: unknown, context?: Record<string, unknown>): PulpeError {
    const pulpeError = createPulpeError(error);

    // Add additional context if provided
    if (context) {
      pulpeError.context = { ...pulpeError.context, ...context };
    }

    // Set as current error
    this.#currentError.set(pulpeError);

    // Add to queue
    this.#addToQueue(pulpeError);

    // Log the error
    this.#logger.info('Error reported to ErrorManager', {
      category: pulpeError.category,
      message: pulpeError.message,
      context: pulpeError.context,
    });

    return pulpeError;
  }

  /**
   * Handle an error with a recovery function
   */
  async handleWithRecovery<T>(
    operation: () => Promise<T>,
    recovery?: (error: PulpeError) => Promise<T>,
  ): Promise<T> {
    try {
      this.#isProcessingError.set(true);
      return await operation();
    } catch (error) {
      const pulpeError = this.reportError(error);

      if (recovery) {
        try {
          this.#logger.info('Attempting error recovery');
          const result = await recovery(pulpeError);
          this.clearCurrentError();
          return result;
        } catch (recoveryError) {
          this.#logger.error('Recovery failed', recoveryError);
          throw recoveryError;
        }
      }

      throw error;
    } finally {
      this.#isProcessingError.set(false);
    }
  }

  /**
   * Clear the current error
   */
  clearCurrentError(): void {
    this.#currentError.set(null);
  }

  /**
   * Clear all errors
   */
  clearAll(): void {
    this.#currentError.set(null);
    this.#errorQueue.set([]);

    if (this.#errorHandler instanceof PulpeErrorHandler) {
      this.#errorHandler.clearHistory();
    }
  }

  /**
   * Process queued errors
   * Can be used for batch error reporting
   */
  processQueue(processor: (errors: PulpeError[]) => void): void {
    const queue = this.#errorQueue();
    if (queue.length > 0) {
      processor(queue);
      this.#errorQueue.set([]);
    }
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(error: unknown): boolean {
    return isRetryableError(error);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10): PulpeError[] {
    if (this.#errorHandler instanceof PulpeErrorHandler) {
      const history = this.#errorHandler.getErrorHistory();
      return history.slice(-limit);
    }
    return [];
  }

  /**
   * Check for critical errors
   */
  hasCriticalError(): boolean {
    const current = this.#currentError();
    return (
      current !== null &&
      (current.category === ErrorCategory.SYSTEM ||
        (!current.retryable && current.category === ErrorCategory.NETWORK))
    );
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    retryable: number;
  } {
    const errors = this.getRecentErrors(100);
    const stats = {
      total: errors.length,
      byCategory: {
        [ErrorCategory.NETWORK]: 0,
        [ErrorCategory.VALIDATION]: 0,
        [ErrorCategory.BUSINESS]: 0,
        [ErrorCategory.SYSTEM]: 0,
        [ErrorCategory.UNKNOWN]: 0,
      },
      retryable: 0,
    };

    errors.forEach((error) => {
      stats.byCategory[error.category]++;
      if (error.retryable) stats.retryable++;
    });

    return stats;
  }

  /**
   * Add error to queue with size limit
   */
  #addToQueue(error: PulpeError): void {
    const maxQueueSize = 20;
    this.#errorQueue.update((queue) => {
      const newQueue = [...queue, error];
      // Keep queue size under control
      if (newQueue.length > maxQueueSize) {
        return newQueue.slice(-maxQueueSize);
      }
      return newQueue;
    });
  }
}
