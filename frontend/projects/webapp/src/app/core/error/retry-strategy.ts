import { Injectable, inject, signal } from '@angular/core';
import { Logger } from '@core/logging/logger';
import { type Observable, retry, timer, throwError, finalize } from 'rxjs';
import {
  type PulpeError,
  isRetryableError,
  createPulpeError,
  ErrorCategory,
} from './error-types';

/**
 * Configuration for retry strategy
 */
export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  maxDelay: number;
  backoffMultiplier: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Default retry configurations by error category
 */
const DEFAULT_RETRY_CONFIGS: Record<ErrorCategory, Partial<RetryConfig>> = {
  [ErrorCategory.NETWORK]: {
    maxAttempts: 3,
    delay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  [ErrorCategory.SYSTEM]: {
    maxAttempts: 2,
    delay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
  },
  [ErrorCategory.VALIDATION]: {
    maxAttempts: 1, // Don't retry validation errors
  },
  [ErrorCategory.BUSINESS]: {
    maxAttempts: 1, // Don't retry business logic errors
  },
  [ErrorCategory.UNKNOWN]: {
    maxAttempts: 2,
    delay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 1.5,
  },
};

/**
 * Retry status for tracking
 */
export interface RetryStatus {
  operationId: string;
  attempt: number;
  maxAttempts: number;
  nextRetryIn?: number;
  error?: PulpeError;
  isRetrying: boolean;
}

/**
 * Service for intelligent retry strategies
 * Provides configurable retry mechanisms with exponential backoff
 */
@Injectable({
  providedIn: 'root',
})
export class RetryStrategy {
  readonly #logger = inject(Logger);

  // Track active retries
  readonly #activeRetries = signal<Map<string, RetryStatus>>(new Map());

  /**
   * Get active retry statuses
   */
  getActiveRetries(): RetryStatus[] {
    return Array.from(this.#activeRetries().values());
  }

  /**
   * Check if operation is currently retrying
   */
  isRetrying(operationId: string): boolean {
    return this.#activeRetries().has(operationId);
  }

  /**
   * Retry a promise-based operation with exponential backoff
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    operationId?: string,
  ): Promise<T> {
    const fullConfig = this.#mergeConfig(config);
    const id = operationId || this.#generateOperationId();

    let lastError: unknown;
    let attempt = 0;

    while (attempt < fullConfig.maxAttempts) {
      attempt++;

      try {
        // Update retry status
        this.#updateRetryStatus(id, {
          operationId: id,
          attempt,
          maxAttempts: fullConfig.maxAttempts,
          isRetrying: true,
        });

        this.#logger.debug(
          `Retry attempt ${attempt}/${fullConfig.maxAttempts}`,
          {
            operationId: id,
          },
        );

        // Execute operation
        const result = await operation();

        // Success - clear retry status
        this.#clearRetryStatus(id);
        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        const shouldRetry =
          fullConfig.shouldRetry?.(error, attempt) ?? isRetryableError(error);

        if (!shouldRetry || attempt >= fullConfig.maxAttempts) {
          // Don't retry or max attempts reached
          this.#clearRetryStatus(id);
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.#calculateDelay(
          attempt,
          fullConfig.delay,
          fullConfig.backoffMultiplier,
          fullConfig.maxDelay,
        );

        // Update status with next retry info
        this.#updateRetryStatus(id, {
          operationId: id,
          attempt,
          maxAttempts: fullConfig.maxAttempts,
          nextRetryIn: delay,
          error: createPulpeError(error),
          isRetrying: true,
        });

        this.#logger.info(`Retrying in ${delay}ms`, {
          operationId: id,
          attempt,
          delay,
        });

        // Wait before retry
        await this.#delay(delay);
      }
    }

    // Should not reach here, but throw last error if it does
    this.#clearRetryStatus(id);
    throw lastError;
  }

  /**
   * Retry an Observable with exponential backoff
   */
  retryObservable<T>(
    source$: Observable<T>,
    config?: Partial<RetryConfig>,
    operationId?: string,
  ): Observable<T> {
    const fullConfig = this.#mergeConfig(config);
    const id = operationId || this.#generateOperationId();

    return source$.pipe(
      retry({
        count: fullConfig.maxAttempts,
        delay: (error, retryCount) => {
          // Check if we should retry
          const shouldRetry =
            fullConfig.shouldRetry?.(error, retryCount) ??
            isRetryableError(error);

          if (!shouldRetry) {
            return throwError(() => error);
          }

          // Calculate delay
          const delay = this.#calculateDelay(
            retryCount,
            fullConfig.delay,
            fullConfig.backoffMultiplier,
            fullConfig.maxDelay,
          );

          // Update retry status
          this.#updateRetryStatus(id, {
            operationId: id,
            attempt: retryCount,
            maxAttempts: fullConfig.maxAttempts,
            nextRetryIn: delay,
            error: createPulpeError(error),
            isRetrying: true,
          });

          this.#logger.info(`Observable retry in ${delay}ms`, {
            operationId: id,
            attempt: retryCount,
            delay,
          });

          return timer(delay);
        },
      }),
      finalize(() => this.#clearRetryStatus(id)),
    );
  }

  /**
   * Wrap an async function with retry logic
   */
  withRetry<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    config?: Partial<RetryConfig>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      return this.retryOperation(() => fn(...args), config);
    };
  }

  /**
   * Get retry configuration for error category
   */
  getConfigForError(error: unknown): RetryConfig {
    const pulpeError = createPulpeError(error);
    const categoryConfig = DEFAULT_RETRY_CONFIGS[pulpeError.category];

    return this.#mergeConfig(categoryConfig);
  }

  /**
   * Calculate delay with exponential backoff
   */
  #calculateDelay(
    attempt: number,
    baseDelay: number,
    multiplier: number,
    maxDelay: number,
  ): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    const delay = Math.min(exponentialDelay + jitter, maxDelay);

    return Math.floor(delay);
  }

  /**
   * Merge configuration with defaults
   */
  #mergeConfig(config?: Partial<RetryConfig>): RetryConfig {
    return {
      maxAttempts: config?.maxAttempts ?? 3,
      delay: config?.delay ?? 1000,
      maxDelay: config?.maxDelay ?? 10000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      shouldRetry: config?.shouldRetry,
    };
  }

  /**
   * Update retry status
   */
  #updateRetryStatus(id: string, status: RetryStatus): void {
    this.#activeRetries.update((retries) => {
      const newRetries = new Map(retries);
      newRetries.set(id, status);
      return newRetries;
    });
  }

  /**
   * Clear retry status
   */
  #clearRetryStatus(id: string): void {
    this.#activeRetries.update((retries) => {
      const newRetries = new Map(retries);
      newRetries.delete(id);
      return newRetries;
    });
  }

  /**
   * Generate unique operation ID
   */
  #generateOperationId(): string {
    return `retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
