import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ErrorHandler } from './error-handler';
import { Result } from '@/shared/domain/result';
import {
  DatabaseException,
  ExternalServiceException,
  TimeoutException,
  _DomainException,
  ValidationException,
} from '@/shared/domain/exceptions/domain.exception';

describe('ErrorHandler', () => {
  let mockLogger: any;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    mockLogger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      setContext: mock(() => mockLogger),
    };
    errorHandler = new ErrorHandler(mockLogger);
  });

  describe('handleAsync', () => {
    it('should handle successful async operation', async () => {
      const operation = async () => 'success';
      const context = { operation: 'test.operation', userId: 'user123' };

      const result = await errorHandler.handleAsync(operation, context);

      expect(result).toBe('success');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'test.operation',
          userId: 'user123',
        }),
        'Starting operation: test.operation',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'test.operation',
          userId: 'user123',
          duration: expect.any(Number),
        }),
        'Operation completed: test.operation',
      );
    });

    it('should handle failed async operation', async () => {
      const error = new Error('Operation failed');
      const operation = async () => {
        throw error;
      };
      const context = { operation: 'test.operation' };

      await expect(
        errorHandler.handleAsync(operation, context),
      ).rejects.toThrow('Operation failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'test.operation',
          duration: expect.any(Number),
          errorType: 'Error',
          err: error,
        }),
        'Error in test.operation: Operation failed',
      );
    });

    it('should return fallback value when rethrow is false', async () => {
      const operation = async () => {
        throw new Error('Failed');
      };
      const context = { operation: 'test.operation' };
      const options = { rethrow: false, fallbackValue: 'fallback' };

      const result = await errorHandler.handleAsync(
        operation,
        context,
        options,
      );

      expect(result).toBe('fallback');
    });

    it('should transform errors when transformer provided', async () => {
      const originalError = new Error('Original');
      const transformedError = new Error('Transformed');
      const operation = async () => {
        throw originalError;
      };
      const context = { operation: 'test.operation' };
      const options = {
        transformError: (_error: Error) => transformedError,
      };

      await expect(
        errorHandler.handleAsync(operation, context, options),
      ).rejects.toThrow('Transformed');
    });

    it('should include metadata in log context', async () => {
      const operation = async () => 'success';
      const context = {
        operation: 'test.operation',
        userId: 'user123',
        entityId: 'entity456',
        metadata: { custom: 'value' },
      };

      await errorHandler.handleAsync(operation, context);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'test.operation',
          userId: 'user123',
          entityId: 'entity456',
          custom: 'value',
        }),
        expect.any(String),
      );
    });
  });

  describe('handle', () => {
    it('should handle successful sync operation', () => {
      const operation = () => 'success';
      const context = { operation: 'test.operation' };

      const result = errorHandler.handle(operation, context);

      expect(result).toBe('success');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle failed sync operation', () => {
      const operation = () => {
        throw new Error('Failed');
      };
      const context = { operation: 'test.operation' };

      expect(() => errorHandler.handle(operation, context)).toThrow('Failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('handleResult', () => {
    it('should handle successful Result', async () => {
      const operation = async () => Result.ok('value');
      const context = { operation: 'test.operation' };

      const result = await errorHandler.handleResult(operation, context);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe('value');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'test.operation' }),
        'Operation succeeded: test.operation',
      );
    });

    it('should handle failed Result', async () => {
      const error = new Error('Failed');
      const operation = async () => Result.fail<string>();
      const context = { operation: 'test.operation' };

      const result = await errorHandler.handleResult(operation, context);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error.message);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'test.operation',
          error: 'Failed',
        }),
        'Operation failed: test.operation',
      );
    });

    it('should handle exceptions during Result operation', async () => {
      const error = new Error('Exception');
      const operation = async () => {
        throw error;
      };
      const context = { operation: 'test.operation' };

      const result = await errorHandler.handleResult(operation, context);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error.message);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('handleDatabase', () => {
    it('should handle successful database operation', async () => {
      const operation = async () => ({ id: 1, name: 'Test' });
      const result = await errorHandler.handleDatabase(operation, 'findUser', {
        userId: 'user123',
      });

      expect(result).toEqual({ id: 1, name: 'Test' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'database.findUser' }),
        expect.any(String),
      );
    });

    it('should transform database errors', async () => {
      const dbError = new Error(
        'duplicate key value violates unique constraint "users_email_key". Key (email)=(test@example.com)',
      );
      const operation = async () => {
        throw dbError;
      };

      await expect(
        errorHandler.handleDatabase(operation, 'createUser', {}),
      ).rejects.toThrow('Duplicate value for email');
    });

    it('should handle foreign key errors', async () => {
      const dbError = new Error('violates foreign key constraint');
      const operation = async () => {
        throw dbError;
      };

      await expect(
        errorHandler.handleDatabase(operation, 'createRelation', {}),
      ).rejects.toThrow('Validation failed');
    });

    it('should handle not-null constraint errors', async () => {
      const dbError = new Error(
        'violates not-null constraint on column "name"',
      );
      const operation = async () => {
        throw dbError;
      };

      await expect(
        errorHandler.handleDatabase(operation, 'createEntity', {}),
      ).rejects.toThrow('Validation failed');
    });

    it('should wrap generic database errors', async () => {
      const dbError = new Error('connection timeout');
      const operation = async () => {
        throw dbError;
      };

      try {
        await errorHandler.handleDatabase(operation, 'query', {});
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseException);

        expect((error as any).message).toBe('connection timeout');

        expect((error as any).operation).toBe('query');
      }
    });
  });

  describe('handleExternalService', () => {
    it('should handle successful external service call', async () => {
      const operation = async () => ({ status: 'ok' });
      const result = await errorHandler.handleExternalService(
        operation,
        'PaymentAPI',
        'process',
        5000,
        { userId: 'user123' },
      );

      expect(result).toEqual({ status: 'ok' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'external.PaymentAPI.process' }),
        expect.any(String),
      );
    });

    it('should handle timeout', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'success';
      };

      await expect(
        errorHandler.handleExternalService(
          operation,
          'SlowAPI',
          'fetch',
          50,
          {},
        ),
      ).rejects.toThrow("Operation 'SlowAPI.fetch' timed out after 50ms");
    });

    it('should transform connection errors', async () => {
      const error = new Error('ECONNREFUSED');
      const operation = async () => {
        throw error;
      };

      try {
        await errorHandler.handleExternalService(
          operation,
          'API',
          'endpoint',
          5000,
          {},
        );
      } catch (err) {
        expect(err).toBeInstanceOf(ExternalServiceException);
        expect((err as any).message).toBe(
          'External service error (API): Service unavailable',
        );
      }
    });

    it('should transform timeout errors', async () => {
      const error = new Error('ETIMEDOUT');
      const operation = async () => {
        throw error;
      };

      try {
        await errorHandler.handleExternalService(
          operation,
          'API',
          'endpoint',
          5000,
          {},
        );
      } catch (err) {
        expect(err).toBeInstanceOf(TimeoutException);
      }
    });
  });

  describe('handleParallel', () => {
    it('should handle all successful operations', async () => {
      const operations = [
        {
          operation: async () => 'result1',
          context: { operation: 'op1' },
        },
        {
          operation: async () => 'result2',
          context: { operation: 'op2' },
        },
      ];

      const results = await errorHandler.handleParallel(operations);

      expect(results).toEqual([
        { success: true, result: 'result1' },
        { success: true, result: 'result2' },
      ]);
    });

    it('should handle mixed success and failure', async () => {
      const error = new Error('Failed');
      const operations = [
        {
          operation: async () => 'success',
          context: { operation: 'op1' },
        },
        {
          operation: async () => {
            throw error;
          },
          context: { operation: 'op2' },
        },
      ];

      const results = await errorHandler.handleParallel(operations);

      expect(results[0]).toEqual({ success: true, result: 'success' });
      expect(results[1].success).toBe(false);

      expect((results[1] as any).error).toBeDefined();
    });

    it('should respect individual operation options', async () => {
      const operations = [
        {
          operation: async () => {
            throw new Error('Error1');
          },
          context: { operation: 'op1' },
          options: { fallbackValue: 'fallback1' },
        },
        {
          operation: async () => {
            throw new Error('Error2');
          },
          context: { operation: 'op2' },
          options: { fallbackValue: 'fallback2' },
        },
      ];

      const results = await errorHandler.handleParallel(operations);

      expect(results).toEqual([
        { success: true, result: 'fallback1' },
        { success: true, result: 'fallback2' },
      ]);
    });
  });

  describe('Error logging', () => {
    it('should log domain exceptions as warnings for client errors', async () => {
      const exception = new ValidationException({ field: ['Client error'] });
      const operation = async () => {
        throw exception;
      };
      const context = { operation: 'test.operation' };

      await expect(
        errorHandler.handleAsync(operation, context),
      ).rejects.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: 'VALIDATION_FAILED' }),
        expect.stringContaining('Business error'),
      );
    });

    it('should log domain exceptions as errors for server errors', async () => {
      const exception = new DatabaseException('Server error');
      const operation = async () => {
        throw exception;
      };
      const context = { operation: 'test.operation' };

      await expect(
        errorHandler.handleAsync(operation, context),
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: 'DATABASE_ERROR' }),
        expect.stringContaining('Error in'),
      );
    });

    it('should handle non-Error exceptions', async () => {
      const operation = async () => {
        throw 'string error';
      };
      const context = { operation: 'test.operation' };

      await expect(
        errorHandler.handleAsync(operation, context),
      ).rejects.toThrow('string error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.any(String),
      );
    });
  });

  describe('forService', () => {
    it('should create scoped error handler', () => {
      const scopedHandler = ErrorHandler.forService('TestService', mockLogger);

      expect(scopedHandler).toBeInstanceOf(ErrorHandler);
      expect(mockLogger.setContext).toHaveBeenCalledWith('TestService');
    });
  });
});
