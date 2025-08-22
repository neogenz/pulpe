import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { PulpeErrorHandler } from './error-handler';
import { Logger } from '@core/logging/logger';
import { ErrorCategory } from './error-types';

describe('PulpeErrorHandler', () => {
  let errorHandler: PulpeErrorHandler;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [PulpeErrorHandler, { provide: Logger, useValue: mockLogger }],
    });

    errorHandler = TestBed.inject(PulpeErrorHandler);
  });

  describe('handleError', () => {
    it('should handle and log network errors', () => {
      const networkError = new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
      });

      errorHandler.handleError(networkError);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Network connectivity issue detected',
        expect.objectContaining({
          category: ErrorCategory.NETWORK,
          retryable: true,
        }),
      );
    });

    it('should handle and log validation errors', () => {
      const validationError = new HttpErrorResponse({
        status: 400,
        error: { message: 'Invalid input data' },
      });

      errorHandler.handleError(validationError);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Validation error',
        expect.objectContaining({
          category: ErrorCategory.VALIDATION,
          message: 'Invalid input data',
        }),
      );
    });

    it('should handle and log business errors', () => {
      const businessError = new HttpErrorResponse({
        status: 403,
        error: { message: 'Access denied' },
      });

      errorHandler.handleError(businessError);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Business rule violation',
        expect.objectContaining({
          category: ErrorCategory.BUSINESS,
          message: 'Access denied',
        }),
      );
    });

    it('should handle and log system errors', () => {
      const systemError = new HttpErrorResponse({
        status: 500,
        error: { message: 'Internal server error' },
      });

      errorHandler.handleError(systemError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'System error occurred',
        expect.objectContaining({
          category: ErrorCategory.SYSTEM,
          message: 'Internal server error',
        }),
      );
    });

    it('should handle and log unknown errors', () => {
      const unknownError = 'String error';

      errorHandler.handleError(unknownError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unknown error occurred',
        expect.objectContaining({
          category: ErrorCategory.UNKNOWN,
          message: 'String error',
        }),
      );
    });

    it('should unwrap Zone.js errors', () => {
      const originalError = new Error('Original error');
      const zoneError = {
        ngOriginalError: originalError,
      };

      errorHandler.handleError(zoneError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unknown error occurred',
        expect.objectContaining({
          message: 'Original error',
        }),
      );
    });

    it('should unwrap promise rejection errors', () => {
      const rejectionError = new Error('Rejection error');
      const wrappedError = {
        rejection: rejectionError,
      };

      errorHandler.handleError(wrappedError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unknown error occurred',
        expect.objectContaining({
          message: 'Rejection error',
        }),
      );
    });
  });

  describe('Error History', () => {
    it('should maintain error history', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorHandler.handleError(error1);
      errorHandler.handleError(error2);

      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('Error 1');
      expect(history[1].message).toBe('Error 2');
    });

    it('should limit error history size', () => {
      // Add more than max history size (50)
      for (let i = 0; i < 55; i++) {
        errorHandler.handleError(new Error(`Error ${i}`));
      }

      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(50);
      // First 5 errors should be removed
      expect(history[0].message).toBe('Error 5');
      expect(history[49].message).toBe('Error 54');
    });

    it('should clear error history', () => {
      errorHandler.handleError(new Error('Error 1'));
      errorHandler.handleError(new Error('Error 2'));

      expect(errorHandler.getErrorHistory()).toHaveLength(2);

      errorHandler.clearHistory();

      expect(errorHandler.getErrorHistory()).toHaveLength(0);
    });

    it('should get last error', () => {
      errorHandler.handleError(new Error('First error'));
      errorHandler.handleError(new Error('Last error'));

      const lastError = errorHandler.getLastError();
      expect(lastError?.message).toBe('Last error');
    });

    it('should return undefined when no errors exist', () => {
      const lastError = errorHandler.getLastError();
      expect(lastError).toBeUndefined();
    });
  });

  describe('Error Context', () => {
    it('should include context from HTTP errors', () => {
      const httpError = new HttpErrorResponse({
        status: 404,
        statusText: 'Not Found',
        url: 'https://api.example.com/user',
      });

      errorHandler.handleError(httpError);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Validation error',
        expect.objectContaining({
          context: expect.objectContaining({
            url: 'https://api.example.com/user',
            status: 404,
            statusText: 'Not Found',
          }),
        }),
      );
    });

    it('should include timestamp in error history', () => {
      const error = new Error('Test error');
      const beforeTime = new Date();

      errorHandler.handleError(error);

      const afterTime = new Date();
      const lastError = errorHandler.getLastError();

      expect(lastError?.timestamp).toBeInstanceOf(Date);
      expect(lastError?.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(lastError?.timestamp.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });
  });
});
