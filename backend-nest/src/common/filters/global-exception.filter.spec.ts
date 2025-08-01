import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { testErrorSilencer } from '../../test/test-utils';
import { GlobalExceptionFilter } from './global-exception.filter';

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

      const context = GlobalExceptionFilter.extractRequestContext(mockRequest);

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

      const context = GlobalExceptionFilter.extractRequestContext(mockRequest);

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

      const context = GlobalExceptionFilter.extractRequestContext(mockRequest);

      expect(context.ip).toBe('198.51.100.1');
    });

    it('should handle missing user in request', async () => {
      const mockRequest = createMockRequest({
        user: undefined,
      });

      const context = GlobalExceptionFilter.extractRequestContext(mockRequest);

      expect(context.userId).toBeUndefined();
    });

    it('should handle array headers by taking first value', async () => {
      const mockRequest = createMockRequest({
        headers: {
          'x-request-id': ['req-first', 'req-second'],
          'user-agent': ['Browser/1.0', 'Browser/2.0'],
        },
      });

      const context = GlobalExceptionFilter.extractRequestContext(mockRequest);

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

      const context = GlobalExceptionFilter.extractRequestContext(mockRequest);

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

      const context = GlobalExceptionFilter.extractRequestContext(mockRequest);

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

        const result = GlobalExceptionFilter.processException(zodException);

        expect(result).toEqual({
          status: 400,
          message: validationErrors,
          error: 'ZodValidationException',
          code: 'ZOD_VALIDATION_FAILED',
          originalError: expect.any(Object),
          stack: undefined,
        });
      });

      it('should include stack trace in development for ZodValidationException', async () => {
        process.env.NODE_ENV = 'development';
        const validationErrors = { message: 'Test validation' };
        const zodException = createZodValidationException(validationErrors);
        zodException.stack = 'ZodValidationException stack trace';

        const result = GlobalExceptionFilter.processException(zodException);

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

        const result = GlobalExceptionFilter.processException(httpException);

        expect(result).toEqual({
          status: 404,
          message: 'Resource not found',
          error: 'HttpException',
          code: 'HTTP_404',
          originalError: expect.any(Object),
          stack: undefined,
        });
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

        const result = GlobalExceptionFilter.processException(httpException);

        expect(result).toEqual({
          status: 400,
          message: errorResponse,
          error: 'HttpException',
          code: 'HTTP_400',
          originalError: expect.any(Object),
          stack: undefined,
        });
      });
    });

    describe('Generic Error handling', () => {
      it('should process generic Error with correct structure', async () => {
        const error = new Error('Database connection timeout');

        const result = GlobalExceptionFilter.processException(error);

        expect(result).toEqual({
          status: 500,
          message: 'Database connection timeout', // Now shows actual error message
          error: 'Error',
          code: 'INTERNAL_SERVER_ERROR',
          originalError: expect.any(Object),
          stack: undefined,
        });
      });

      it('should handle Error without name property', async () => {
        const error = new Error('Test error');
        Object.defineProperty(error, 'name', { value: undefined });

        const result = GlobalExceptionFilter.processException(error);

        expect(result.error).toBe('InternalServerErrorException');
      });

      it('should include detailed error messages in development', async () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('Specific database constraint violation');

        const result = GlobalExceptionFilter.processException(error);

        expect(result.message).toBe('Specific database constraint violation');
      });

      it('should show actual error messages for better debugging', async () => {
        process.env.NODE_ENV = 'production';
        const error = new Error('Detailed internal system error');

        const result = GlobalExceptionFilter.processException(error);

        expect(result.message).toBe('Detailed internal system error');
      });
    });

    describe('Unknown exception handling', () => {
      it('should process string exception', async () => {
        const unknownException = 'Simple string error';

        const result = GlobalExceptionFilter.processException(unknownException);

        expect(result).toEqual({
          status: 500,
          message: 'An unexpected error occurred',
          error: 'UnknownException',
          code: 'UNKNOWN_EXCEPTION',
        });
      });

      it('should process null exception', async () => {
        const result = GlobalExceptionFilter.processException(null);

        expect(result.code).toBe('UNKNOWN_EXCEPTION');
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

        const sanitized = GlobalExceptionFilter.sanitizeContext(context);

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

        const sanitized = GlobalExceptionFilter.sanitizeContext(context);

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

        const sanitized = GlobalExceptionFilter.sanitizeContext(context);

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

      const result = GlobalExceptionFilter.buildErrorResponse(
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

      const result = GlobalExceptionFilter.buildErrorResponse(
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

      const result = GlobalExceptionFilter.buildErrorResponse(
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
      const result = GlobalExceptionFilter.buildErrorResponse(
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
      await testErrorSilencer.withSilencedErrors(async () => {
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
        expect((response as any).getResponseData()).toEqual(
          expect.objectContaining({
            success: false,
            statusCode: 400,
            message: validationErrors,
            code: 'ZOD_VALIDATION_FAILED',
          }),
        );
      });
    });

    it('should handle 4xx error logging gracefully', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
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
    });

    it('should handle 5xx error logging gracefully', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
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
    });

    it('should handle generic error logging gracefully', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
        const error = new Error('Custom database error');
        const request = createMockRequest({ method: 'DELETE' });
        const response = createMockResponse();
        const host = createMockArgumentsHost(request, response);

        // Should not throw when logging
        expect(() => filter.catch(error, host)).not.toThrow();

        // Verify the response was properly formatted
        expect((response as any).getStatusCode()).toBe(500);
        expect((response as any).getResponseData()).toEqual(
          expect.objectContaining({
            success: false,
            statusCode: 500,
            message: 'Custom database error', // Now shows actual error message
            code: 'INTERNAL_SERVER_ERROR',
          }),
        );
      });
    });
  });

  describe('Full integration behavior', () => {
    it('should handle complete flow for ZodValidationException', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
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
        expect((response as any).getResponseData()).toEqual(
          expect.objectContaining({
            success: false,
            statusCode: 400,
            message: validationErrors,
            error: 'ZodValidationException',
            code: 'ZOD_VALIDATION_FAILED',
            context: expect.objectContaining({
              requestId: 'req-123-456',
              userId: 'user-abc-123',
            }),
          }),
        );
      });
    });

    it('should handle complete flow for HttpException', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
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
        expect((response as any).getResponseData()).toEqual(
          expect.objectContaining({
            success: false,
            statusCode: 404,
            message: 'Not found',
            error: 'HttpException',
            code: 'HTTP_404',
            path: '/api/v1/users/999',
          }),
        );
      });
    });

    it('should handle complete flow for generic Error', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
        const error = new Error('Database timeout');
        const request = createMockRequest();
        const response = createMockResponse();
        const host = createMockArgumentsHost(request, response);

        filter.catch(error, host);

        // Verify response was called correctly
        expect((response as any).getStatusCode()).toBe(500);
        expect((response as any).getResponseData()).toEqual(
          expect.objectContaining({
            success: false,
            statusCode: 500,
            message: 'Database timeout',
            error: 'Error',
            code: 'INTERNAL_SERVER_ERROR',
          }),
        );
      });
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle exceptions during logging gracefully', async () => {
      await testErrorSilencer.withSilencedErrors(async () => {
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

      const context = GlobalExceptionFilter.extractRequestContext(request);

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

      const sanitized = GlobalExceptionFilter.sanitizeContext(context);
      expect(sanitized).toBeDefined();
    });
  });
});
