import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { RetryStrategy } from './retry-strategy';
import { Logger } from '@core/logging/logger';
import { HttpErrorResponse } from '@angular/common/http';

describe('RetryStrategy', () => {
  let retryStrategy: RetryStrategy;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [RetryStrategy, { provide: Logger, useValue: mockLogger }],
    });

    retryStrategy = TestBed.inject(RetryStrategy);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('retryOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryStrategy.retryOperation(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');

      const promise = retryStrategy.retryOperation(operation, {
        maxAttempts: 3,
        delay: 100,
      });

      // Fast-forward first retry delay
      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retrying in'),
        expect.any(Object),
      );
    });

    it('should fail after max attempts', async () => {
      const error = new Error('Persistent failure');
      const operation = vi.fn().mockRejectedValue(error);

      const promise = retryStrategy.retryOperation(operation, {
        maxAttempts: 2,
        delay: 50,
      });

      // Fast-forward through retries
      await vi.advanceTimersByTimeAsync(50);

      await expect(promise).rejects.toThrow('Persistent failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const validationError = new HttpErrorResponse({
        status: 400,
        error: { message: 'Validation failed' },
      });
      const operation = vi.fn().mockRejectedValue(validationError);

      await expect(retryStrategy.retryOperation(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use custom shouldRetry function', async () => {
      const error = new Error('Custom error');
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const shouldRetry = vi.fn().mockReturnValue(true);

      const promise = retryStrategy.retryOperation(operation, {
        maxAttempts: 2,
        delay: 50,
        shouldRetry,
      });

      await vi.advanceTimersByTimeAsync(50);
      const result = await promise;

      expect(result).toBe('success');
      expect(shouldRetry).toHaveBeenCalledWith(error, 1);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryStrategy.retryOperation(operation, {
        maxAttempts: 3,
        delay: 100,
        backoffMultiplier: 2,
      });

      // First retry after ~100ms (with jitter)
      await vi.advanceTimersByTimeAsync(150);
      expect(operation).toHaveBeenCalledTimes(2);

      // Second retry after ~200ms (with jitter)
      await vi.advanceTimersByTimeAsync(250);
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect max delay', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      const promise = retryStrategy.retryOperation(operation, {
        maxAttempts: 2,
        delay: 1000,
        maxDelay: 500,
        backoffMultiplier: 10,
      });

      // Should cap at maxDelay (500ms) despite high multiplier
      await vi.advanceTimersByTimeAsync(600);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('retryObservable', () => {
    it('should retry observable on error', async () => {
      let attempts = 0;
      const source$ = new Observable((subscriber) => {
        attempts++;
        if (attempts < 3) {
          subscriber.error(new Error(`Attempt ${attempts}`));
        } else {
          subscriber.next('success');
          subscriber.complete();
        }
      });

      const result$ = retryStrategy.retryObservable(source$, {
        maxAttempts: 3,
        delay: 50,
      });

      const promise = firstValueFrom(result$);

      // Fast-forward through retries
      await vi.advanceTimersByTimeAsync(150);

      const result = await promise;
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail observable after max attempts', async () => {
      const error = new Error('Persistent error');
      const source$ = throwError(() => error);

      const result$ = retryStrategy.retryObservable(source$, {
        maxAttempts: 2,
        delay: 50,
      });

      const promise = firstValueFrom(result$);

      // Fast-forward through retry
      await vi.advanceTimersByTimeAsync(100);

      await expect(promise).rejects.toThrow('Persistent error');
    });
  });

  describe('withRetry', () => {
    it('should wrap function with retry logic', async () => {
      const originalFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      const wrappedFn = retryStrategy.withRetry(originalFn, {
        maxAttempts: 2,
        delay: 50,
      });

      const promise = wrappedFn('arg1', 'arg2');

      await vi.advanceTimersByTimeAsync(50);
      const result = await promise;

      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Active Retry Tracking', () => {
    it('should track active retries', async () => {
      const operation = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('success'), 200);
          }),
      );

      const promise = retryStrategy.retryOperation(
        operation,
        { maxAttempts: 1 },
        'test-operation',
      );

      expect(retryStrategy.isRetrying('test-operation')).toBe(true);

      const activeRetries = retryStrategy.getActiveRetries();
      expect(activeRetries).toHaveLength(1);
      expect(activeRetries[0].operationId).toBe('test-operation');
      expect(activeRetries[0].isRetrying).toBe(true);

      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(retryStrategy.isRetrying('test-operation')).toBe(false);
      expect(retryStrategy.getActiveRetries()).toHaveLength(0);
    });

    it('should update retry status on each attempt', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce('success');

      const promise = retryStrategy.retryOperation(
        operation,
        { maxAttempts: 2, delay: 50 },
        'tracked-op',
      );

      // Check initial attempt
      let status = retryStrategy
        .getActiveRetries()
        .find((r) => r.operationId === 'tracked-op');
      expect(status?.attempt).toBe(1);

      await vi.advanceTimersByTimeAsync(50);

      // Check retry attempt
      status = retryStrategy
        .getActiveRetries()
        .find((r) => r.operationId === 'tracked-op');
      expect(status?.attempt).toBe(2);

      await promise;

      // Should be cleared after success
      expect(retryStrategy.getActiveRetries()).toHaveLength(0);
    });
  });

  describe('Error Category Configuration', () => {
    it('should get appropriate config for network errors', () => {
      const networkError = new HttpErrorResponse({ status: 0 });
      const config = retryStrategy.getConfigForError(networkError);

      expect(config.maxAttempts).toBe(3);
      expect(config.delay).toBe(1000);
      expect(config.backoffMultiplier).toBe(2);
    });

    it('should get appropriate config for validation errors', () => {
      const validationError = new HttpErrorResponse({ status: 400 });
      const config = retryStrategy.getConfigForError(validationError);

      expect(config.maxAttempts).toBe(1); // Should not retry
    });

    it('should get appropriate config for system errors', () => {
      const systemError = new HttpErrorResponse({ status: 500 });
      const config = retryStrategy.getConfigForError(systemError);

      expect(config.maxAttempts).toBe(2);
      expect(config.delay).toBe(2000);
      expect(config.backoffMultiplier).toBe(1.5);
    });
  });
});

// Helper to import Observable and firstValueFrom
import { Observable, firstValueFrom } from 'rxjs';
