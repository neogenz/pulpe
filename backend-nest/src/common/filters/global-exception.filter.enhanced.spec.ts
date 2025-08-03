import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { GlobalExceptionFilterEnhanced } from './global-exception.filter.enhanced';
import {
  EntityNotFoundException,
  ValidationException,
  DatabaseException,
  ExternalServiceException as _ExternalServiceException,
  RateLimitException,
  UnauthorizedException,
} from '@/shared/domain/exceptions/domain.exception';
import { ErrorCode } from '../constants/error-codes.enum';

describe('GlobalExceptionFilterEnhanced', () => {
  let filter: GlobalExceptionFilterEnhanced;
  let mockLogger: any;
  let mockHost: ArgumentsHost;
  let mockRequest: any;
  let mockResponse: any;
  let mockGetRequest: any;
  let mockGetResponse: any;

  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';

    mockLogger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      setContext: mock(() => mockLogger),
    };

    mockRequest = {
      url: '/api/v1/test',
      method: 'POST',
      headers: {
        'x-request-id': 'req-123',
        'user-agent': 'Test Agent',
      },
      ip: '127.0.0.1',
      user: { id: 'user-456' },
      body: { test: 'data' },
      connection: { remoteAddress: '127.0.0.1' },
    };

    mockResponse = {
      status: mock(() => mockResponse),
      json: mock(() => mockResponse),
      setHeader: mock(() => mockResponse),
    };

    mockGetRequest = mock(() => mockRequest);
    mockGetResponse = mock(() => mockResponse);

    mockHost = {
      switchToHttp: mock(() => ({
        getRequest: mockGetRequest,
        getResponse: mockGetResponse,
      })),
    } as any;

    filter = new GlobalExceptionFilterEnhanced(mockLogger);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Domain Exception Handling', () => {
    it('should handle EntityNotFoundException', () => {
      const exception = new EntityNotFoundException('User', '123');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 404,
          code: 'ENTITY_NOT_FOUND',
          message: 'User with id 123 not found',
          error: 'EntityNotFoundException',
          details: {
            entityType: 'User',
            entityId: '123',
          },
          context: expect.objectContaining({
            requestId: 'req-123',
            userId: 'user-456',
          }),
        }),
      );
    });

    it('should handle ValidationException', () => {
      const errors = {
        email: ['Invalid format', 'Required'],
        password: ['Too short'],
      };
      const exception = new ValidationException(errors);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          details: { errors },
        }),
      );
    });

    it('should handle DatabaseException', () => {
      const exception = new DatabaseException(
        'Connection failed',
        'SELECT',
        'SELECT * FROM users',
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      // Get the actual call to see what was passed
      const actualCall = mockResponse.json.mock.calls[0]?.[0];

      // First check that the response has basic fields
      expect(actualCall).toBeDefined();
      expect(actualCall.statusCode).toBe(500);
      expect(actualCall.code).toBe('DATABASE_ERROR');
      expect(actualCall.message).toBe('Connection failed');

      // Check details separately to see what's there
      expect(actualCall.details).toBeDefined();
      expect(actualCall.details).toEqual({
        operation: 'SELECT',
        query: 'SELECT * FROM users',
      });
    });

    it('should handle RateLimitException with retry header', () => {
      const exception = new RateLimitException(100, 60000, 45);

      filter.catch(exception, mockHost);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 45);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should handle UnauthorizedException', () => {
      const exception = new UnauthorizedException('Invalid token');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        }),
      );
    });
  });

  describe('Zod Validation Exception Handling', () => {
    it('should handle ZodValidationException', () => {
      const zodErrors = [
        {
          path: ['email'],
          message: 'Invalid email',
          code: 'invalid_type' as const,
          expected: 'string' as const,
          received: 'undefined' as const,
        },
        {
          path: ['nested', 'field'],
          message: 'Required',
          code: 'invalid_type' as const,
          expected: 'string' as const,
          received: 'undefined' as const,
        },
      ];
      const zodError = new ZodError(zodErrors);
      const exception = new ZodValidationException(zodError);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Validation failed',
          details: {
            errors: {
              email: ['Invalid email'],
              'nested.field': ['Required'],
            },
            zodErrors,
          },
        }),
      );
    });
  });

  describe('HTTP Exception Handling', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          code: ErrorCode.NOT_FOUND,
          message: 'Not found',
          error: 'HttpException',
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        { message: 'Custom error', error: 'CustomError' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Custom error',
          error: 'CustomError',
        }),
      );
    });
  });

  describe('Generic Error Handling', () => {
    it('should handle generic Error', () => {
      const error = new Error('Something went wrong');

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
          error: 'Error',
        }),
      );
    });

    it('should identify database errors', () => {
      const dbError = new Error(
        'duplicate key value violates unique constraint',
      );

      filter.catch(dbError, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DatabaseException',
          code: ErrorCode.DATABASE_ERROR,
        }),
      );
    });

    it('should handle unknown exceptions', () => {
      const unknownError = 'string error';

      filter.catch(unknownError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred',
          details: { error: 'string error' },
        }),
      );
    });
  });

  describe('Context and Logging', () => {
    it('should extract request context', () => {
      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            requestId: 'req-123',
            userId: 'user-456',
            userAgent: 'Test Agent',
            ip: '127.0.0.1',
          },
        }),
      );
    });

    it('should sanitize context in production', () => {
      process.env.NODE_ENV = 'production';
      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            requestId: 'req-123',
            userId: 'user-456',
            // userAgent and ip should be excluded
          },
        }),
      );
    });

    it('should log server errors with error level', () => {
      const error = new DatabaseException('DB Error');
      filter.catch(error, mockHost);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'exception_handling',
          statusCode: 500,
          errorCode: 'DATABASE_ERROR',
          err: error,
        }),
        expect.stringContaining('Server error'),
      );
    });

    it('should log client errors with warning level', () => {
      const error = new EntityNotFoundException('User', '123');
      filter.catch(error, mockHost);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'exception_handling',
          statusCode: 404,
          errorCode: 'ENTITY_NOT_FOUND',
        }),
        expect.stringContaining('Client error'),
      );
    });

    it('should sanitize request body in logs', () => {
      mockRequest.body = {
        username: 'test',
        password: 'secret123',
        token: 'jwt-token',
      };

      filter.catch(new Error('Test'), mockHost);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            username: 'test',
            password: '[REDACTED]',
            token: '[REDACTED]',
          },
        }),
        expect.any(String),
      );
    });
  });

  describe('Response Headers', () => {
    it('should set cache control for client errors', () => {
      filter.catch(new EntityNotFoundException('User', '123'), mockHost);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-store, must-revalidate',
      );
    });

    it('should not set cache control for server errors', () => {
      filter.catch(new DatabaseException('Error'), mockHost);

      expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
        'Cache-Control',
        expect.any(String),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing request headers', () => {
      mockRequest.headers = undefined;
      mockRequest.user = undefined;

      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            requestId: undefined,
            userId: undefined,
            userAgent: undefined,
            ip: '127.0.0.1',
          },
        }),
      );
    });

    it('should handle array header values', () => {
      mockRequest.headers['x-request-id'] = ['id1', 'id2'];
      mockRequest.headers['user-agent'] = ['agent1', 'agent2'];

      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            requestId: 'id1',
            userAgent: 'agent1',
          }),
        }),
      );
    });

    it('should exclude stack traces in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');

      filter.catch(error, mockHost);

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall.stack).toBeUndefined();
    });

    it('should include stack traces in development', () => {
      const error = new Error('Test error');

      filter.catch(error, mockHost);

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall.stack).toBeDefined();
    });
  });
});
