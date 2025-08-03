import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { _HttpStatus } from '@nestjs/common';
import { ErrorMapper } from './error-mapper';
import {
  EntityNotFoundException,
  ValidationException,
  DatabaseException,
  ExternalServiceException,
  TimeoutException,
  RateLimitException,
  MissingDataException,
} from '@/shared/domain/exceptions/domain.exception';
import { ErrorCode } from '../constants/error-codes.enum';

describe('ErrorMapper', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('mapDomainException', () => {
    it('should map basic domain exception', () => {
      const exception = new EntityNotFoundException('User', '123');
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped).toEqual({
        statusCode: 404,
        code: 'ENTITY_NOT_FOUND',
        message: 'User with id 123 not found',
        details: {
          entityType: 'User',
          entityId: '123',
        },
        stack: expect.any(String),
      });
    });

    it('should map validation exception with errors', () => {
      const errors = {
        email: ['Invalid format'],
        password: ['Too short'],
      };
      const exception = new ValidationException(errors);
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped).toEqual({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: { errors },
        stack: expect.any(String),
      });
    });

    it('should map database exception with operation', () => {
      const exception = new DatabaseException(
        'Connection failed',
        'INSERT',
        'INSERT INTO...',
      );
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped).toEqual({
        statusCode: 500,
        code: 'DATABASE_ERROR',
        message: 'Connection failed',
        details: {
          operation: 'INSERT',
          query: 'INSERT INTO...',
        },
        stack: expect.any(String),
      });
    });

    it('should sanitize database query in production', () => {
      process.env.NODE_ENV = 'production';
      const exception = new DatabaseException(
        'Error',
        'SELECT',
        'SELECT * FROM users',
      );
      const mapped = ErrorMapper.mapDomainException(exception);

      // In production, details should not be included at all
      expect(mapped.details).toBeUndefined();
    });

    it('should map external service exception', () => {
      const exception = new ExternalServiceException(
        'PaymentAPI',
        'Timeout',
        '/process',
      );
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped).toEqual({
        statusCode: 502,
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'External service error (PaymentAPI): Timeout',
        details: {
          service: 'PaymentAPI',
          endpoint: '/process',
        },
        stack: expect.any(String),
      });
    });

    it('should map timeout exception', () => {
      const exception = new TimeoutException('fetchData', 5000);
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped).toEqual({
        statusCode: 504,
        code: 'TIMEOUT',
        message: "Operation 'fetchData' timed out after 5000ms",
        details: {
          operation: 'fetchData',
          timeoutMs: 5000,
        },
        stack: expect.any(String),
      });
    });

    it('should map rate limit exception with retry after', () => {
      const exception = new RateLimitException(100, 60000, 45);
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped).toEqual({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded: 100 requests per 60s',
        details: {
          limit: 100,
          windowMs: 60000,
          retryAfter: 45,
        },
        stack: expect.any(String),
      });
    });

    it('should map missing data exception', () => {
      const exception = new MissingDataException('userId');
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped).toEqual({
        statusCode: 400,
        code: 'MISSING_DATA',
        message: 'Required data missing: userId',
        details: {
          field: 'userId',
        },
        stack: expect.any(String),
      });
    });

    it('should exclude stack trace in production', () => {
      process.env.NODE_ENV = 'production';
      const exception = new EntityNotFoundException('User', '123');
      const mapped = ErrorMapper.mapDomainException(exception);

      expect(mapped.stack).toBeUndefined();
    });

    it('should exclude details when includeDetails is false', () => {
      const exception = new EntityNotFoundException('User', '123');
      const mapped = ErrorMapper.mapDomainException(exception, {
        includeDetails: false,
      });

      expect(mapped.details).toBeUndefined();
    });
  });

  describe('mapError', () => {
    it('should map domain exceptions', () => {
      const exception = new EntityNotFoundException('User', '123');
      const mapped = ErrorMapper.mapError(exception);

      expect(mapped.statusCode).toBe(404);
      expect(mapped.code).toBe('ENTITY_NOT_FOUND');
    });

    it('should map generic errors', () => {
      const error = new Error('Something went wrong');
      const mapped = ErrorMapper.mapError(error);

      expect(mapped).toEqual({
        statusCode: 500,
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Something went wrong',
        stack: expect.any(String),
      });
    });

    it('should map generic errors with sanitized message in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Database connection failed');
      const mapped = ErrorMapper.mapError(error);

      expect(mapped.message).toBe('An unexpected error occurred');
      expect(mapped.stack).toBeUndefined();
    });

    it('should map unknown errors', () => {
      const mapped = ErrorMapper.mapError('string error');

      expect(mapped).toEqual({
        statusCode: 500,
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        details: {
          error: 'string error',
          type: 'string',
        },
      });
    });

    it('should map null/undefined errors', () => {
      const mappedNull = ErrorMapper.mapError(null);
      const mappedUndefined = ErrorMapper.mapError(undefined);

      expect(mappedNull.statusCode).toBe(500);
      expect(mappedUndefined.statusCode).toBe(500);
    });
  });

  describe('getStatusForErrorCode', () => {
    it('should return correct status for error codes', () => {
      expect(
        ErrorMapper.getStatusForErrorCode(ErrorCode.VALIDATION_FAILED),
      ).toBe(400);
      expect(ErrorMapper.getStatusForErrorCode(ErrorCode.UNAUTHORIZED)).toBe(
        401,
      );
      expect(ErrorMapper.getStatusForErrorCode(ErrorCode.FORBIDDEN)).toBe(403);
      expect(ErrorMapper.getStatusForErrorCode(ErrorCode.NOT_FOUND)).toBe(404);
      expect(ErrorMapper.getStatusForErrorCode(ErrorCode.CONFLICT)).toBe(409);
      expect(
        ErrorMapper.getStatusForErrorCode(ErrorCode.BUSINESS_RULE_VIOLATION),
      ).toBe(422);
      expect(
        ErrorMapper.getStatusForErrorCode(ErrorCode.RATE_LIMIT_EXCEEDED),
      ).toBe(429);
      expect(
        ErrorMapper.getStatusForErrorCode(ErrorCode.INTERNAL_SERVER_ERROR),
      ).toBe(500);
    });

    it('should return 500 for unknown error codes', () => {
      expect(
        ErrorMapper.getStatusForErrorCode('UNKNOWN_CODE' as ErrorCode),
      ).toBe(500);
    });
  });

  describe('isServerError', () => {
    it('should identify server errors', () => {
      const serverError = new DatabaseException('Error');
      const clientError = new EntityNotFoundException('User', '123');
      const genericError = new Error('Generic');

      expect(ErrorMapper.isServerError(serverError)).toBe(true);
      expect(ErrorMapper.isServerError(clientError)).toBe(false);
      expect(ErrorMapper.isServerError(genericError)).toBe(true);
    });
  });

  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const mappedError = {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: { id: '123' },
      };
      const request = { path: '/api/users/123', method: 'GET' };
      const context = { requestId: 'req-123', userId: 'user-456' };

      const response = ErrorMapper.createErrorResponse(
        mappedError,
        request,
        context,
      );

      expect(response).toEqual({
        success: false,
        statusCode: 404,
        timestamp: expect.any(String),
        path: '/api/users/123',
        method: 'GET',
        message: 'Resource not found',
        error: 'NOT_FOUND',
        code: 'NOT_FOUND',
        details: { id: '123' },
        context: { requestId: 'req-123', userId: 'user-456' },
      });
    });

    it('should include stack trace when present', () => {
      const mappedError = {
        statusCode: 500,
        code: 'ERROR',
        message: 'Error',
        stack: 'Error stack trace',
      };
      const request = { path: '/', method: 'POST' };

      const response = ErrorMapper.createErrorResponse(mappedError, request);

      expect(response.stack).toBe('Error stack trace');
    });
  });

  describe('sanitizeMessage', () => {
    it('should sanitize sensitive information from messages', () => {
      const messages = [
        { input: 'password=secret123', expected: '[REDACTED]' },
        { input: 'token: abc123def', expected: '[REDACTED]' },
        { input: 'api_key=xyz789', expected: '[REDACTED]' },
        { input: 'secret = mysecret', expected: '[REDACTED]' },
        { input: 'API-KEY: 12345', expected: '[REDACTED]' },
      ];

      messages.forEach(({ input, expected }) => {
        const sanitized = ErrorMapper.sanitizeMessage(input);
        expect(sanitized).toBe(expected);
      });
    });

    it('should not modify messages without sensitive data', () => {
      const message = 'User not found in database';
      const sanitized = ErrorMapper.sanitizeMessage(message);
      expect(sanitized).toBe(message);
    });

    it('should handle multiple sensitive values', () => {
      const message = 'password=123 and token=abc';
      const sanitized = ErrorMapper.sanitizeMessage(message);
      expect(sanitized).toBe('[REDACTED] and [REDACTED]');
    });
  });
});
