import { describe, it, expect } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';
import { ErrorDefinition } from '@common/constants/error-definitions';

describe('BusinessException', () => {
  const mockErrorDefinition: ErrorDefinition = {
    code: 'ERR_TEST_ERROR',
    message: (details?: Record<string, unknown>) =>
      details?.id ? `Test error with ID '${details.id}'` : 'Test error',
    httpStatus: HttpStatus.BAD_REQUEST,
  };

  describe('constructor', () => {
    it('should create an exception with basic properties', () => {
      const exception = new BusinessException(
        mockErrorDefinition,
        { id: '123' },
        { userId: 'user-456' },
      );

      expect(exception.code).toBe('ERR_TEST_ERROR');
      expect(exception.message).toBe("Test error with ID '123'");
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.details).toEqual({ id: '123' });
      expect(exception.loggingContext).toEqual({ userId: 'user-456' });
      expect(exception.name).toBe('BusinessException');
    });

    it('should handle error definition without details', () => {
      const exception = new BusinessException(mockErrorDefinition);

      expect(exception.message).toBe('Test error');
      expect(exception.details).toBeUndefined();
      expect(exception.loggingContext).toEqual({});
    });

    it('should preserve cause when provided', () => {
      const originalError = new Error('Original error');
      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        { operation: 'test' },
        { cause: originalError },
      );

      expect(exception.cause).toBe(originalError);
      expect(exception.loggingContext).not.toHaveProperty('originalError');
    });
  });

  describe('getCauseChain', () => {
    it('should return empty array when no cause', () => {
      const exception = new BusinessException(mockErrorDefinition);

      expect(exception.getCauseChain()).toEqual([]);
    });

    it('should return single cause', () => {
      const cause = new Error('Root cause');
      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause },
      );

      const chain = exception.getCauseChain();
      expect(chain).toHaveLength(1);
      expect(chain[0]).toBe(cause);
    });

    it('should return full cause chain with Error.cause', () => {
      // Create a chain: root -> middle -> top
      const rootCause = new Error('Root cause');

      const middleCause = new Error('Middle cause');
      (middleCause as any).cause = rootCause;

      const topCause = new Error('Top cause');
      (topCause as any).cause = middleCause;

      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause: topCause },
      );

      const chain = exception.getCauseChain();
      expect(chain).toHaveLength(3);
      expect((chain[0] as Error).message).toBe('Top cause');
      expect((chain[1] as Error).message).toBe('Middle cause');
      expect((chain[2] as Error).message).toBe('Root cause');
    });

    it('should handle originalError property pattern', () => {
      const rootCause = new Error('Root');
      const middleCause = {
        message: 'Middle',
        originalError: rootCause,
      };
      const topCause = {
        message: 'Top',
        originalError: middleCause,
      };

      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause: topCause },
      );

      const chain = exception.getCauseChain();
      expect(chain).toHaveLength(3);
      expect(chain[0]).toBe(topCause);
      expect(chain[1]).toBe(middleCause);
      expect(chain[2]).toBe(rootCause);
    });

    it('should handle parentError property pattern', () => {
      const rootCause = new Error('Root');
      const customError = {
        message: 'Custom',
        parentError: rootCause,
      };

      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause: customError },
      );

      const chain = exception.getCauseChain();
      expect(chain).toHaveLength(2);
      expect(chain[0]).toBe(customError);
      expect(chain[1]).toBe(rootCause);
    });

    it('should handle circular references safely', () => {
      const error1: any = new Error('Error 1');
      const error2: any = new Error('Error 2');

      // Create circular reference
      error1.cause = error2;
      error2.cause = error1;

      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause: error1 },
      );

      // Should not throw or infinite loop
      const chain = exception.getCauseChain();
      expect(chain).toHaveLength(2); // Should stop at circular reference
      expect(chain[0]).toBe(error1);
      expect(chain[1]).toBe(error2);
    });
  });

  describe('getRootCause', () => {
    it('should return undefined when no cause', () => {
      const exception = new BusinessException(mockErrorDefinition);

      expect(exception.getRootCause()).toBeUndefined();
    });

    it('should return the only cause when single cause', () => {
      const cause = new Error('Single cause');
      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause },
      );

      expect(exception.getRootCause()).toBe(cause);
    });

    it('should return the deepest cause in chain', () => {
      const rootCause = new Error('Root');
      const middleCause = new Error('Middle');
      const topCause = new Error('Top');

      (middleCause as any).cause = rootCause;
      (topCause as any).cause = middleCause;

      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause: topCause },
      );

      expect(exception.getRootCause()).toBe(rootCause);
    });

    it('should handle non-Error causes', () => {
      const stringCause = 'String error';
      const objectCause = { error: 'Object error' };

      const exception1 = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause: stringCause },
      );

      const exception2 = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause: objectCause },
      );

      expect(exception1.getRootCause()).toBe(stringCause);
      expect(exception2.getRootCause()).toBe(objectCause);
    });
  });

  describe('integration with HttpException', () => {
    it('should properly extend HttpException', () => {
      const exception = new BusinessException(mockErrorDefinition, {
        id: '123',
      });

      expect(exception).toBeInstanceOf(BusinessException);
      expect(exception.getResponse()).toBe("Test error with ID '123'");
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should pass cause to parent HttpException when supported', () => {
      const cause = new Error('Cause');
      const exception = new BusinessException(
        mockErrorDefinition,
        undefined,
        undefined,
        { cause },
      );

      // Vérifier que la cause est bien passée au parent
      // Note: Cela dépend de la version de @nestjs/common
      expect(exception.cause).toBe(cause);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle database error chain', () => {
      // Simulate a typical database error chain
      const socketError = new Error('ECONNREFUSED 127.0.0.1:5432');
      socketError.name = 'SocketError';

      const dbError = new Error('Connection to database failed');
      dbError.name = 'DatabaseError';
      (dbError as any).cause = socketError;

      const serviceError = new Error('Failed to create budget');
      serviceError.name = 'ServiceError';
      (serviceError as any).cause = dbError;

      const businessException = new BusinessException(
        {
          code: 'ERR_BUDGET_CREATE_FAILED',
          message: () => 'Failed to create budget',
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        },
        { budgetId: '123' },
        { userId: 'user-456', operation: 'create' },
        { cause: serviceError },
      );

      const chain = businessException.getCauseChain();
      expect(chain).toHaveLength(3);

      const rootCause = businessException.getRootCause();
      expect(rootCause).toBe(socketError);
      expect((rootCause as Error).message).toContain('ECONNREFUSED');
    });

    it('should handle Supabase error pattern', () => {
      // Simulate Supabase PostgrestError
      const supabaseError = {
        message:
          'duplicate key value violates unique constraint "budgets_user_month_year_key"',
        code: '23505',
        details: 'Key (user_id, month, year)=(123, 3, 2024) already exists.',
        hint: null,
        originalError: new Error('PostgreSQL Error'),
      };

      const exception = new BusinessException(
        {
          code: 'ERR_BUDGET_ALREADY_EXISTS',
          message: (details) =>
            `Budget for ${details?.month}/${details?.year} already exists`,
          httpStatus: HttpStatus.CONFLICT,
        },
        { month: 3, year: 2024 },
        {
          userId: '123',
          postgresCode: '23505',
          constraint: 'budgets_user_month_year_key',
        },
        { cause: supabaseError },
      );

      expect(exception.message).toBe('Budget for 3/2024 already exists');
      expect(exception.loggingContext.postgresCode).toBe('23505');

      const chain = exception.getCauseChain();
      expect(chain[0]).toBe(supabaseError);
      expect((chain[1] as Error).message).toBe('PostgreSQL Error');
    });
  });
});
