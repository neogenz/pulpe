import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import type { PinoLogger } from 'nestjs-pino';
import { GlobalExceptionFilter } from './global-exception.filter';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

// Helper to create a proper ZodValidationException
const createZodValidationException = (response: any) => {
  const zodError = new ZodError([
    {
      code: 'custom',
      path: ['test'],
      message: 'Test validation error',
    },
  ]);

  const exception = new ZodValidationException(zodError);
  exception.getResponse = () => response;

  return exception;
};

// Mock helpers
const createMockRequest = (overrides: any = {}): Request => {
  const baseRequest = {
    headers: {
      'x-request-id': 'req-123-456',
      'user-agent': 'Mozilla/5.0 (Test Browser)',
      authorization: 'Bearer test-token',
    },
    method: 'POST',
    url: '/api/v1/users',
    body: { name: 'Test User', email: 'test@example.com' },
    ip: '192.168.1.100',
    connection: {
      remoteAddress: '192.168.1.100',
    },
    user: { id: 'user-abc-123' },
  } as any;

  const result = { ...baseRequest, ...overrides };
  if (overrides.headers !== undefined) {
    result.headers = { ...baseRequest.headers, ...overrides.headers };
  }

  return result;
};

const createMockResponse = (): Response => {
  let statusCode = 200;
  let responseData: any = null;

  const response = {
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    json: (data: any) => {
      responseData = data;
      return response;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  } as any;

  return response;
};

const createMockArgumentsHost = (
  request: Request,
  response: Response,
): ArgumentsHost => {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockLogger: any;

  beforeEach(async () => {
    // Mock PinoLogger with simple functions
    mockLogger = {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };

    filter = new GlobalExceptionFilter(mockLogger);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('Context extraction', () => {
    it('should extract complete context from request with all headers', async () => {
      const mockRequest = createMockRequest({
        headers: {
          'x-request-id': 'custom-req-id-789',
          'user-agent': 'Custom/1.0 Browser',
        },
        ip: '10.0.0.1',
        user: { id: 'custom-user-456' },
      });

      const context = (filter as any).extractRequestContext(mockRequest);

      expect(context).toEqual({
        requestId: 'custom-req-id-789',
        userId: 'custom-user-456',
        userAgent: 'Custom/1.0 Browser',
        ip: '10.0.0.1',
      });
    });

    it('should handle missing request ID header', async () => {
      const mockRequest = {
        headers: {
          'user-agent': 'Test Browser',
        },
        method: 'POST',
        url: '/api/v1/users',
        body: { name: 'Test User', email: 'test@example.com' },
        ip: '192.168.1.100',
        connection: {
          remoteAddress: '192.168.1.100',
        },
        user: { id: 'user-abc-123' },
      } as any;

      const context = (filter as any).extractRequestContext(mockRequest);

      expect(context.requestId).toBeUndefined();
      expect(context.userAgent).toBe('Test Browser');
    });

    it('should fallback to connection.remoteAddress when request.ip is missing', async () => {
      const mockRequest = createMockRequest({
        ip: undefined,
        connection: {
          remoteAddress: '198.51.100.1',
        },
      });

      const context = (filter as any).extractRequestContext(mockRequest);

      expect(context.ip).toBe('198.51.100.1');
    });

    it('should handle missing user in request', async () => {
      const mockRequest = createMockRequest({
        user: undefined,
      });

      const context = (filter as any).extractRequestContext(mockRequest);

      expect(context.userId).toBeUndefined();
    });

    it('should handle array headers by taking first value', async () => {
      const mockRequest = createMockRequest({
        headers: {
          'x-request-id': ['req-first', 'req-second'],
          'user-agent': ['Browser/1.0', 'Browser/2.0'],
        },
      });

      const context = (filter as any).extractRequestContext(mockRequest);

      expect(context.requestId).toBe('req-first');
      expect(context.userAgent).toBe('Browser/1.0');
    });

    it('should handle empty array headers', async () => {
      const mockRequest = createMockRequest({
        headers: {
          'x-request-id': [],
          'user-agent': [],
        },
      });

      const context = (filter as any).extractRequestContext(mockRequest);

      expect(context.requestId).toBeUndefined();
      expect(context.userAgent).toBeUndefined();
    });

    it('should handle mixed string and array headers', async () => {
      const mockRequest = createMockRequest({
        headers: {
          'x-request-id': 'single-request-id',
          'user-agent': ['Array Browser/1.0', 'Array Browser/2.0'],
        },
      });

      const context = (filter as any).extractRequestContext(mockRequest);

      expect(context.requestId).toBe('single-request-id');
      expect(context.userAgent).toBe('Array Browser/1.0');
    });
  });

  describe('Exception processing', () => {
    describe('ZodValidationException handling', () => {
      it('should process ZodValidationException with correct error structure', async () => {
        const validationErrors = {
          message: 'Validation failed',
          errors: [
            { path: ['email'], message: 'Invalid email format' },
            { path: ['name'], message: 'Name is required' },
          ],
        };
        const zodException = createZodValidationException(validationErrors);

        const result = (filter as any).processException(zodException);

        expect(result).toMatchObject({
          status: 400,
          message: validationErrors,
          error: 'ZodValidationException',
          code: 'ERR_ZOD_VALIDATION_FAILED',
          stack: undefined,
        });
        expect(result.originalError).toBeDefined();
      });

      it('should include stack trace in development for ZodValidationException', async () => {
        process.env.NODE_ENV = 'development';
        const validationErrors = { message: 'Test validation' };
        const zodException = createZodValidationException(validationErrors);
        zodException.stack = 'ZodValidationException stack trace';

        const result = (filter as any).processException(zodException);

        expect(result.stack).toBe('ZodValidationException stack trace');
      });

      it('should extract detailed validation errors for logging', async () => {
        const validationErrors = {
          message: 'Validation failed',
          errors: [
            {
              code: 'too_small',
              path: ['amount'],
              message: 'Number must be greater than 0',
            },
            {
              code: 'invalid_type',
              path: ['name'],
              message: 'Expected string, received number',
            },
          ],
        };
        const zodException = createZodValidationException(validationErrors);

        const mockRequest = createMockRequest();
        const mockResponse = createMockResponse();
        const mockHost = createMockArgumentsHost(mockRequest, mockResponse);

        // Spy on logger to capture the log message
        const loggerWarnSpy = { calls: [] as any[] };
        const testFilter = new GlobalExceptionFilter({
          ...mockLogger,
          warn: (context: any, message: string) => {
            loggerWarnSpy.calls.push({ context, message });
          },
        });

        testFilter.catch(zodException, mockHost);

        expect(loggerWarnSpy.calls).toHaveLength(1);
        expect(loggerWarnSpy.calls[0].message).toBe(
          'CLIENT ERROR: Validation failed - amount: Number must be greater than 0, name: Expected string, received number',
        );
      });
    });

    describe('HttpException handling', () => {
      it('should process HttpException with correct error structure', async () => {
        const httpException = new HttpException(
          'Resource not found',
          HttpStatus.NOT_FOUND,
        );

        const result = (filter as any).processException(httpException);

        expect(result).toMatchObject({
          status: 404,
          message: 'Resource not found',
          error: 'HttpException',
          code: 'HTTP_404',
          stack: undefined,
        });
        expect(result.originalError).toBeDefined();
      });

      it('should handle HttpException with object response', async () => {
        const errorResponse = {
          message: 'Multiple validation errors',
          errors: ['Field 1 invalid', 'Field 2 required'],
        };
        const httpException = new HttpException(
          errorResponse,
          HttpStatus.BAD_REQUEST,
        );

        const result = (filter as any).processException(httpException);

        expect(result).toMatchObject({
          status: 400,
          message: errorResponse,
          error: 'HttpException',
          code: 'HTTP_400',
          stack: undefined,
        });
        expect(result.originalError).toBeDefined();
      });
    });

    describe('Generic Error handling', () => {
      it('should process generic Error with correct structure', async () => {
        const error = new Error('Database connection timeout');

        const result = (filter as any).processException(error);

        expect(result).toMatchObject({
          status: 500,
          message: 'Database connection timeout',
          error: 'Error',
          code: 'ERR_INTERNAL_SERVER',
          stack: undefined,
        });
        expect(result.originalError).toBeDefined();
      });

      it('should handle Error without name property', async () => {
        const error = new Error('Test error');
        Object.defineProperty(error, 'name', { value: undefined });

        const result = (filter as any).processException(error);

        expect(result.error).toBe('InternalServerErrorException');
      });

      it('should include detailed error messages in development', async () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('Specific database constraint violation');

        const result = (filter as any).processException(error);

        expect(result.message).toBe('Specific database constraint violation');
      });

      it('should show actual error messages for better debugging', async () => {
        process.env.NODE_ENV = 'production';
        const error = new Error('Detailed internal system error');

        const result = (filter as any).processException(error);

        expect(result.message).toBe('Detailed internal system error');
      });
    });

    describe('Unknown exception handling', () => {
      it('should process string exception', async () => {
        const unknownException = 'Simple string error';

        const result = (filter as any).processException(unknownException);

        expect(result).toEqual({
          status: 500,
          message: 'An unknown error occurred',
          error: 'UnknownException',
          code: 'ERR_UNKNOWN',
        });
      });

      it('should process null exception', async () => {
        const result = (filter as any).processException(null);

        expect(result.code).toBe('ERR_UNKNOWN');
        expect(result.error).toBe('UnknownException');
      });
    });
  });

  describe('Context sanitization', () => {
    describe('Production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should sanitize context in production environment', async () => {
        const context = {
          requestId: 'req-prod-123',
          userId: 'user-prod-456',
          userAgent: 'Sensitive Browser Information',
          ip: '10.0.0.1',
        };

        const sanitized = (filter as any).sanitizeContext(context);

        expect(sanitized).toEqual({
          requestId: 'req-prod-123',
          userId: 'user-prod-456',
        });
        expect(sanitized).not.toHaveProperty('userAgent');
        expect(sanitized).not.toHaveProperty('ip');
      });
    });

    describe('Development environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should include full context in development environment', async () => {
        const context = {
          requestId: 'req-dev-123',
          userId: 'user-dev-456',
          userAgent: 'Development Browser',
          ip: '127.0.0.1',
        };

        const sanitized = (filter as any).sanitizeContext(context);

        expect(sanitized).toEqual({
          requestId: 'req-dev-123',
          userId: 'user-dev-456',
          userAgent: 'Development Browser',
          ip: '127.0.0.1',
        });
      });
    });

    describe('Undefined environment (default behavior)', () => {
      it('should behave like production when NODE_ENV is undefined', async () => {
        delete process.env.NODE_ENV;

        const context = {
          requestId: 'req-123',
          userId: 'user-456',
          userAgent: 'Browser Info',
          ip: '10.0.0.1',
        };

        const sanitized = (filter as any).sanitizeContext(context);

        expect(sanitized).toEqual({
          requestId: 'req-123',
          userId: 'user-456',
        });
        expect(sanitized).not.toHaveProperty('userAgent');
        expect(sanitized).not.toHaveProperty('ip');
      });
    });
  });

  describe('Error response building', () => {
    it('should build standardized error response with all fields', async () => {
      const errorData = {
        status: 400,
        message: 'Validation failed',
        error: 'BadRequestException',
        code: 'VALIDATION_ERROR',
        stack: 'Error stack trace',
      };
      const request = createMockRequest({
        method: 'POST',
        url: '/api/v1/auth/login',
      });
      const context = {
        requestId: 'req-abc-123',
        userId: 'user-def-456',
      };

      const result = (filter as any).buildErrorResponse(
        errorData,
        request,
        context,
      );

      expect(result).toEqual({
        success: false,
        statusCode: 400,
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
        path: '/api/v1/auth/login',
        method: 'POST',
        error: 'BadRequestException',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        context: {
          requestId: 'req-abc-123',
          userId: 'user-def-456',
        },
        stack: 'Error stack trace',
      });
    });

    it('should handle complex message objects', async () => {
      const complexMessage = {
        message: 'Multiple validation errors',
        errors: [
          { field: 'email', error: 'Invalid format' },
          { field: 'password', error: 'Too short' },
        ],
        code: 'COMPLEX_VALIDATION',
      };
      const errorData = {
        status: 422,
        message: complexMessage,
        error: 'ValidationException',
        code: 'VALIDATION_COMPLEX',
      };
      const request = createMockRequest();
      const context = { requestId: 'req-123' };

      const result = (filter as any).buildErrorResponse(
        errorData,
        request,
        context,
      );

      expect(result.message).toEqual(complexMessage);
      expect(result.statusCode).toBe(422);
      expect(result.code).toBe('VALIDATION_COMPLEX');
    });

    it('should exclude stack trace when not provided', async () => {
      const errorData = {
        status: 404,
        message: 'Not found',
        error: 'NotFoundException',
        code: 'NOT_FOUND',
        stack: undefined,
      };
      const request = createMockRequest();
      const context = {};

      const result = (filter as any).buildErrorResponse(
        errorData,
        request,
        context,
      );

      expect(result).not.toHaveProperty('stack');
    });

    it('should generate valid timestamp in ISO format', async () => {
      const errorData = {
        status: 500,
        message: 'Error',
        error: 'Error',
        code: 'ERROR',
      };
      const request = createMockRequest();
      const context = {};

      const before = new Date();
      const result = (filter as any).buildErrorResponse(
        errorData,
        request,
        context,
      );
      const after = new Date();

      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Logging behavior', () => {
    it('should handle ZodValidationException logging gracefully', async () => {
      const validationErrors = { message: 'Email validation failed' };
      const zodException = createZodValidationException(validationErrors);

      const request = createMockRequest({
        method: 'PUT',
        url: '/api/v1/users/123',
        body: { email: 'invalid-email' },
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      // Should not throw when logging
      expect(() => filter.catch(zodException, host)).not.toThrow();

      // Verify the response was properly formatted
      expect((response as any).getStatusCode()).toBe(400);
      const responseData = (response as any).getResponseData();
      expect(responseData).toMatchObject({
        success: false,
        statusCode: 400,
        message: validationErrors,
        code: 'ERR_ZOD_VALIDATION_FAILED',
      });
    });

    it('should handle 4xx error logging gracefully', async () => {
      const httpException = new HttpException(
        'Unauthorized access',
        HttpStatus.UNAUTHORIZED,
      );
      const request = createMockRequest({
        method: 'GET',
        url: '/api/v1/protected',
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      // Should not throw when logging
      expect(() => filter.catch(httpException, host)).not.toThrow();

      // Verify the response was properly formatted
      expect((response as any).getStatusCode()).toBe(401);
      expect((response as any).getResponseData()).toEqual(
        expect.objectContaining({
          success: false,
          statusCode: 401,
          message: 'Unauthorized access',
          code: 'HTTP_401',
        }),
      );
    });

    it('should handle 5xx error logging gracefully', async () => {
      const httpException = new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      // Should not throw when logging
      expect(() => filter.catch(httpException, host)).not.toThrow();

      // Verify the response was properly formatted
      expect((response as any).getStatusCode()).toBe(500);
      expect((response as any).getResponseData()).toEqual(
        expect.objectContaining({
          success: false,
          statusCode: 500,
          message: 'Internal server error',
          code: 'HTTP_500',
        }),
      );
    });

    it('should handle generic error logging gracefully', async () => {
      const error = new Error('Custom database error');
      const request = createMockRequest({ method: 'DELETE' });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      // Should not throw when logging
      expect(() => filter.catch(error, host)).not.toThrow();

      // Verify the response was properly formatted
      expect((response as any).getStatusCode()).toBe(500);
      const responseData = (response as any).getResponseData();
      expect(responseData).toMatchObject({
        success: false,
        statusCode: 500,
        message: 'Custom database error',
        code: 'ERR_INTERNAL_SERVER',
      });
    });
  });

  describe('Full integration behavior', () => {
    it('should handle complete flow for ZodValidationException', async () => {
      const validationErrors = {
        message: 'Validation failed',
        errors: [{ path: ['email'], message: 'Invalid email' }],
      };
      const zodException = createZodValidationException(validationErrors);
      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      filter.catch(zodException, host);

      // Verify response was called correctly
      expect((response as any).getStatusCode()).toBe(400);
      const responseData = (response as any).getResponseData();
      expect(responseData).toMatchObject({
        success: false,
        statusCode: 400,
        message: validationErrors,
        error: 'ZodValidationException',
        code: 'ERR_ZOD_VALIDATION_FAILED',
      });
      expect(responseData.context).toMatchObject({
        requestId: 'req-123-456',
        userId: 'user-abc-123',
      });
    });

    it('should handle complete flow for HttpException', async () => {
      const httpException = new HttpException(
        'Not found',
        HttpStatus.NOT_FOUND,
      );
      const request = createMockRequest({ url: '/api/v1/users/999' });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      filter.catch(httpException, host);

      // Verify response was called correctly
      expect((response as any).getStatusCode()).toBe(404);
      const responseData = (response as any).getResponseData();
      expect(responseData).toMatchObject({
        success: false,
        statusCode: 404,
        message: 'Not found',
        error: 'HttpException',
        code: 'HTTP_404',
        path: '/api/v1/users/999',
      });
    });

    it('should handle complete flow for generic Error', async () => {
      const error = new Error('Database timeout');
      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      filter.catch(error, host);

      // Verify response was called correctly
      expect((response as any).getStatusCode()).toBe(500);
      const responseData = (response as any).getResponseData();
      expect(responseData).toMatchObject({
        success: false,
        statusCode: 500,
        message: 'Database timeout',
        error: 'Error',
        code: 'ERR_INTERNAL_SERVER',
      });
    });
  });

  describe('BusinessException handling with cause chains', () => {
    it('should process BusinessException with enriched context and cause chain', async () => {
      // Create a complex error chain
      const socketError = new Error('ECONNREFUSED 127.0.0.1:5432');
      socketError.name = 'SocketError';

      const dbError = new Error('Connection to database failed');
      dbError.name = 'DatabaseError';
      (dbError as any).cause = socketError;

      const serviceError = new Error('Failed to create budget');
      serviceError.name = 'ServiceError';
      (serviceError as any).cause = dbError;

      const businessException = new BusinessException(
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        { templateId: 'tpl-123' },
        {
          userId: 'user-456',
          operation: 'createBudget',
          attemptedMonth: 3,
          attemptedYear: 2024,
        },
        { cause: serviceError },
      );

      const result = (filter as any).processException(businessException);

      expect(result).toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: expect.stringContaining('Failed to create budget'),
        error: 'BusinessException',
        code: 'ERR_BUDGET_CREATE_FAILED',
        originalError: businessException,
        details: { templateId: 'tpl-123' },
        loggingContext: expect.objectContaining({
          userId: 'user-456',
          operation: 'createBudget',
          attemptedMonth: 3,
          attemptedYear: 2024,
          causeChain: expect.arrayContaining([
            expect.objectContaining({
              depth: 1,
              name: 'ServiceError',
              message: 'Failed to create budget',
            }),
            expect.objectContaining({
              depth: 2,
              name: 'DatabaseError',
              message: 'Connection to database failed',
            }),
            expect.objectContaining({
              depth: 3,
              name: 'SocketError',
              message: 'ECONNREFUSED 127.0.0.1:5432',
            }),
          ]),
          rootCause: expect.objectContaining({
            name: 'SocketError',
            message: 'ECONNREFUSED 127.0.0.1:5432',
          }),
        }),
      });
    });

    it('should include stack traces in cause chain during development', async () => {
      process.env.NODE_ENV = 'development';

      const rootError = new Error('Root cause');
      rootError.stack = 'Root stack trace';

      const businessException = new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'test' },
        { cause: rootError },
      );

      const result = (filter as any).processException(businessException);

      expect(result.loggingContext.causeChain[0]).toHaveProperty(
        'stack',
        'Root stack trace',
      );
      expect(result.loggingContext.rootCause).toHaveProperty(
        'stack',
        'Root stack trace',
      );
    });

    it('should include stack traces in cause chain in production for logging', async () => {
      process.env.NODE_ENV = 'production';

      const rootError = new Error('Root cause');
      rootError.stack = 'Root stack trace';

      const businessException = new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'test' },
        { cause: rootError },
      );

      const result = (filter as any).processException(businessException);

      expect(result.loggingContext.causeChain[0]).toHaveProperty('stack');
      expect(result.loggingContext.rootCause).toHaveProperty('stack');
    });

    it('should handle BusinessException without cause', async () => {
      const businessException = new BusinessException(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: 'Invalid input' },
        { userId: 'user-123', endpoint: '/api/v1/budgets' },
      );

      const result = (filter as any).processException(businessException);

      expect(result.loggingContext.causeChain).toEqual([]);
      expect(result.loggingContext.rootCause).toBeNull();
    });

    it('should handle non-Error root causes', async () => {
      const stringCause = 'String error message';

      const businessException = new BusinessException(
        ERROR_DEFINITIONS.UNKNOWN_EXCEPTION,
        undefined,
        { operation: 'parse' },
        { cause: stringCause },
      );

      const result = (filter as any).processException(businessException);

      expect(result.loggingContext.causeChain).toHaveLength(1);
      expect(result.loggingContext.rootCause).toEqual({ value: stringCause });
    });

    it('should handle Supabase-style error patterns', async () => {
      const postgresError = new Error('PostgreSQL Error');

      const supabaseError = {
        message:
          'duplicate key value violates unique constraint "budgets_user_month_year_key"',
        code: '23505',
        details: 'Key (user_id, month, year)=(123, 3, 2024) already exists.',
        hint: null,
        originalError: postgresError,
      };

      const businessException = new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month: 3, year: 2024 },
        {
          userId: '123',
          postgresCode: '23505',
          constraint: 'budgets_user_month_year_key',
        },
        { cause: supabaseError },
      );

      const result = (filter as any).processException(businessException);

      expect(result.loggingContext.causeChain).toHaveLength(2);
      expect(result.loggingContext.causeChain[0]).toMatchObject({
        depth: 1,
        name: 'UnknownError',
        message:
          'duplicate key value violates unique constraint "budgets_user_month_year_key"',
      });
      expect(result.loggingContext.causeChain[1]).toMatchObject({
        depth: 2,
        name: 'Error',
        message: 'PostgreSQL Error',
      });
    });

    it('should log BusinessException with enriched context', async () => {
      const rootError = new Error('Database connection failed');
      const businessException = new BusinessException(
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        { templateId: 'tpl-123' },
        { userId: 'user-456', operation: 'create' },
        { cause: rootError },
      );

      const request = createMockRequest({
        method: 'POST',
        url: '/api/v1/budgets',
        body: { templateId: 'tpl-123', month: 3, year: 2024 },
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      // Spy on logger to capture the log context
      const loggerErrorSpy = { calls: [] as any[] };
      const testFilter = new GlobalExceptionFilter({
        ...mockLogger,
        error: (context: any, message: string) => {
          loggerErrorSpy.calls.push({ context, message });
        },
      });

      testFilter.catch(businessException, host);

      expect(loggerErrorSpy.calls).toHaveLength(1);
      expect(loggerErrorSpy.calls[0].message).toBe(
        'SERVER ERROR: Failed to create budget',
      );
      expect(loggerErrorSpy.calls[0].context).toMatchObject({
        requestId: 'req-123-456',
        userId: 'user-456',
        operation: 'create',
        causeChain: expect.any(Array),
        rootCause: expect.objectContaining({
          name: 'Error',
          message: 'Database connection failed',
        }),
      });
    });

    it('should properly format BusinessException response with details', async () => {
      const businessException = new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: 'budget-123' },
        { userId: 'user-456', operation: 'findOne' },
      );

      const request = createMockRequest({
        method: 'GET',
        url: '/api/v1/budgets/budget-123',
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      filter.catch(businessException, host);

      expect((response as any).getStatusCode()).toBe(HttpStatus.NOT_FOUND);
      expect((response as any).getResponseData()).toEqual(
        expect.objectContaining({
          success: false,
          statusCode: HttpStatus.NOT_FOUND,
          message: expect.stringContaining(
            "Budget with ID 'budget-123' not found",
          ),
          error: 'BusinessException',
          code: 'ERR_BUDGET_NOT_FOUND',
          details: { id: 'budget-123' },
          path: '/api/v1/budgets/budget-123',
          method: 'GET',
        }),
      );
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle exceptions during logging gracefully', async () => {
      const error = new Error('Original error');
      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      // Should not throw even if logging fails
      expect(() => filter.catch(error, host)).not.toThrow();

      // Response should still be called
      expect((response as any).getStatusCode()).toBe(500);
      expect((response as any).getResponseData()).toBeDefined();
    });

    it('should handle empty headers object', async () => {
      const request = {
        headers: {}, // Completely empty headers
        method: 'POST',
        url: '/api/v1/users',
        body: { name: 'Test User', email: 'test@example.com' },
        ip: '192.168.1.100',
        connection: {
          remoteAddress: '192.168.1.100',
        },
        user: { id: 'user-abc-123' },
      } as any;

      const context = (filter as any).extractRequestContext(request);

      expect(context).toEqual({
        requestId: undefined,
        userId: 'user-abc-123',
        userAgent: undefined,
        ip: '192.168.1.100',
      });
    });

    it('should handle null values in context', async () => {
      const context = {
        requestId: null as any,
        userId: null as any,
        userAgent: null as any,
        ip: null as any,
      };

      const sanitized = (filter as any).sanitizeContext(context);
      expect(sanitized).toBeDefined();
    });
  });

  describe('Single Logging Guarantee', () => {
    it('should log BusinessException exactly once with merged service context', () => {
      const spiedLogger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        fatal: () => {},
      } as unknown as PinoLogger;

      const errorSpy = spyOn(spiedLogger, 'error');
      const warnSpy = spyOn(spiedLogger, 'warn');

      const spiedFilter = new GlobalExceptionFilter(spiedLogger);

      const exception = new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        { id: 'tx-123' },
        {
          operation: 'insertTransaction',
          userId: 'user-1',
          supabaseErrorCode: 'PGRST301',
        },
        { cause: new Error('Connection refused') },
      );

      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      spiedFilter.catch(exception, host);

      // CRITICAL: logger.error should be called exactly once
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();

      // Verify merged context from service
      const logCall = errorSpy.mock.calls[0] as unknown[];
      const logContext = logCall[0] as Record<string, unknown>;

      expect(logContext).toMatchObject({
        operation: 'insertTransaction',
        userId: 'user-1',
        supabaseErrorCode: 'PGRST301',
      });

      // Verify cause chain is included
      expect(logContext.causeChain).toBeDefined();
      expect(Array.isArray(logContext.causeChain)).toBe(true);
      expect((logContext.causeChain as unknown[]).length).toBeGreaterThan(0);
      expect((logContext.causeChain as { message: string }[])[0]).toMatchObject(
        {
          message: 'Connection refused',
        },
      );

      // Verify message format
      const logMessage = logCall[1] as string;
      expect(logMessage).toContain('SERVER ERROR');
    });

    it('should include full stack trace in causeChain in development', () => {
      process.env.NODE_ENV = 'development';

      const spiedLogger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        fatal: () => {},
      } as unknown as PinoLogger;

      const errorSpy = spyOn(spiedLogger, 'error');
      const spiedFilter = new GlobalExceptionFilter(spiedLogger);

      const rootCause = new Error('ECONNREFUSED');
      const exception = new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'query' },
        { cause: rootCause },
      );

      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      spiedFilter.catch(exception, host);

      expect(errorSpy).toHaveBeenCalledTimes(1);

      const logCall = errorSpy.mock.calls[0] as unknown[];
      const logContext = logCall[0] as Record<string, unknown>;

      // In development, stack trace should be included
      const causeChain = logContext.causeChain as { stack?: string }[];
      expect(causeChain[0].stack).toBeDefined();
      expect(causeChain[0].stack).toContain('ECONNREFUSED');
    });

    it('should include stack trace in causeChain in production for logging', () => {
      process.env.NODE_ENV = 'production';

      const spiedLogger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        fatal: () => {},
      } as unknown as PinoLogger;

      const errorSpy = spyOn(spiedLogger, 'error');
      const spiedFilter = new GlobalExceptionFilter(spiedLogger);

      const rootCause = new Error('ECONNREFUSED');
      const exception = new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'query' },
        { cause: rootCause },
      );

      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      spiedFilter.catch(exception, host);

      expect(errorSpy).toHaveBeenCalledTimes(1);

      const logCall = errorSpy.mock.calls[0] as unknown[];
      const logContext = logCall[0] as Record<string, unknown>;

      // In production, stack trace SHOULD be in causeChain for debugging
      const causeChain = logContext.causeChain as { stack?: string }[];
      expect(causeChain[0].stack).toBeDefined();
    });

    it('should preserve rootCause info in log context', () => {
      const spiedLogger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        fatal: () => {},
      } as unknown as PinoLogger;

      const errorSpy = spyOn(spiedLogger, 'error');
      const spiedFilter = new GlobalExceptionFilter(spiedLogger);

      const rootCause = new Error('Database connection timeout');
      const exception = new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'fetchBudget', userId: 'user-123' },
        { cause: rootCause },
      );

      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      spiedFilter.catch(exception, host);

      const logCall = errorSpy.mock.calls[0] as unknown[];
      const logContext = logCall[0] as Record<string, unknown>;

      expect(logContext.rootCause).toBeDefined();
      expect(logContext.rootCause).toMatchObject({
        name: 'Error',
        message: 'Database connection timeout',
      });
    });

    it('should use warn for 4xx errors and error for 5xx', () => {
      const spiedLogger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        fatal: () => {},
      } as unknown as PinoLogger;

      const errorSpy = spyOn(spiedLogger, 'error');
      const warnSpy = spyOn(spiedLogger, 'warn');
      const spiedFilter = new GlobalExceptionFilter(spiedLogger);

      // Test 4xx - should use warn
      const notFoundException = new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: 'budget-123' },
        { operation: 'findBudget', userId: 'user-1' },
      );

      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      spiedFilter.catch(notFoundException, host);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
      expect((warnSpy.mock.calls[0] as unknown[])[1] as string).toContain(
        'CLIENT ERROR',
      );
    });
  });
});
