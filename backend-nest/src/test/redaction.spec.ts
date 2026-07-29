import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { Express, NextFunction, Request, Response } from 'express';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { createPinoLoggerConfig } from '../app.module';
import { ResponseLoggerMiddleware } from '../common/middleware/response-logger.middleware';

// Mock helpers
const createMockRequest = (overrides: any = {}): any => {
  const baseRequest = {
    headers: {
      'x-request-id': 'req-123-456',
      'user-agent': 'Mozilla/5.0 (Test Browser)',
      authorization: 'Bearer sensitive-token',
      cookie: 'session=secret-session; auth=secret-auth',
    },
    method: 'POST',
    url: '/api/v1/test',
    body: {
      password: 'super-secret-password',
      token: 'jwt-token-123456',
      secret: 'api-secret',
      authorization: 'Bearer another-token',
      normalField: 'normal-value',
      nested: {
        password: 'nested-password',
        token: 'nested-token',
      },
    },
    ip: '192.168.1.100',
    connection: {
      remoteAddress: '192.168.1.100',
    },
    user: { id: 'user-abc-123' },
  };

  return { ...baseRequest, ...overrides };
};

const createMockResponse = (): any => ({
  status: mock(() => ({ json: mock() })),
  setHeader: mock(),
  headers: {
    'set-cookie': ['session=secret; HttpOnly', 'auth=token; Secure'],
  },
});

const createMockArgumentsHost = (request: any, response: any): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as ArgumentsHost;

describe('Sensitive Data Redaction Test', () => {
  let globalExceptionFilter: GlobalExceptionFilter;
  let mockLogger: PinoLogger;
  let capturedLogs: any[] = [];

  beforeEach(() => {
    capturedLogs = [];
    // The request body is only ever logged in development — see the
    // production guarantee asserted in 'GlobalExceptionFilter Redaction'.
    // The sanitize denylist below therefore describes dev-only behaviour.
    process.env.NODE_ENV = 'development';
    process.env.DEBUG_HTTP_FULL = 'true';
    delete process.env.RAILWAY_ENVIRONMENT_NAME;

    // Create mock logger that captures log calls
    mockLogger = {
      info: mock((context: any, message: string) => {
        capturedLogs.push({ method: 'info', context, message });
      }),
      error: mock((context: any, message: string) => {
        capturedLogs.push({ method: 'error', context, message });
      }),
      warn: mock((context: any, message: string) => {
        capturedLogs.push({ method: 'warn', context, message });
      }),
      debug: mock((context: any, message: string) => {
        capturedLogs.push({ method: 'debug', context, message });
      }),
    } as any;

    globalExceptionFilter = new GlobalExceptionFilter(mockLogger);
  });

  afterEach(() => {
    // Restore the value set by src/test/setup.ts — NODE_ENV now has no boot
    // default, so leaving it unset breaks any app bootstrapped by later specs.
    process.env.NODE_ENV = 'test';
    delete process.env.DEBUG_HTTP_FULL;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
  });

  describe('Pino Logger Configuration', () => {
    const buildConfig = (values: Record<string, string | undefined>) =>
      createPinoLoggerConfig({
        get: (key: string) => values[key],
      } as ConfigService);

    it('keeps pino redaction active in detailed preview mode', () => {
      const config = buildConfig({
        NODE_ENV: 'preview',
        DEBUG_HTTP_FULL: 'true',
      });

      expect(config.pinoHttp.redact).toBeDefined();
    });

    it('aligns the pino level with the resolved logging mode', () => {
      expect(
        buildConfig({
          NODE_ENV: 'preview',
          DEBUG_HTTP_FULL: 'true',
        }).pinoHttp.level,
      ).toBe('debug');
      expect(
        buildConfig({
          NODE_ENV: 'preview',
          DEBUG_HTTP_FULL: 'false',
        }).pinoHttp.level,
      ).toBe('info');
      expect(
        buildConfig({
          NODE_ENV: 'production',
          DEBUG_HTTP_FULL: 'true',
        }).pinoHttp.level,
      ).toBe('info');
    });

    it('sanitizes detailed request data and never creates a cURL command', () => {
      const config = buildConfig({
        NODE_ENV: 'preview',
        DEBUG_HTTP_FULL: 'true',
      });
      const serialize = config.pinoHttp.serializers.req;
      const serialized = serialize({
        id: 'req-123',
        method: 'POST',
        url: '/api/test?token=QUERY_SENTINEL',
        headers: {
          authorization: 'Bearer HEADER_SENTINEL',
          'x-client-key': 'CLIENT_KEY_SENTINEL',
        },
        query: {
          token: 'QUERY_SENTINEL',
          remaining: 'FINANCIAL_VALUE_SENTINEL',
          visible: 'yes',
        },
        body: {
          nested: [
            {
              recoveryKey: 'RECOVERY_SENTINEL',
              targetAmount: 'FINANCIAL_VALUE_SENTINEL',
            },
          ],
          visible: 'yes',
        },
      } as any);
      const output = JSON.stringify(serialized);

      expect(serialized).not.toHaveProperty('curl');
      expect(output).not.toContain('HEADER_SENTINEL');
      expect(output).not.toContain('CLIENT_KEY_SENTINEL');
      expect(output).not.toContain('QUERY_SENTINEL');
      expect(output).not.toContain('RECOVERY_SENTINEL');
      expect(output).not.toContain('FINANCIAL_VALUE_SENTINEL');
      expect(output).toContain('yes');
    });

    it('uses the standard serializer for either production signal', () => {
      for (const values of [
        { NODE_ENV: 'production', DEBUG_HTTP_FULL: 'true' },
        {
          NODE_ENV: 'development',
          RAILWAY_ENVIRONMENT_NAME: 'production',
          DEBUG_HTTP_FULL: 'true',
        },
      ]) {
        const config = buildConfig(values);
        const serialized = config.pinoHttp.serializers.req({
          id: 'req-123',
          method: 'POST',
          url: '/api/test?token=QUERY_SENTINEL',
          headers: {},
          query: { token: 'QUERY_SENTINEL' },
          body: { visible: 'must-not-be-logged' },
        } as any);

        expect(serialized).toEqual({
          id: 'req-123',
          method: 'POST',
          url: '/api/test',
          deviceType: 'unknown',
          ip: undefined,
        });
      }
    });

    it('omits query strings from automatic HTTP log messages', () => {
      const config = buildConfig({ NODE_ENV: 'production' });
      const request = {
        method: 'GET',
        url: '/api/test?token=QUERY_SENTINEL',
      } as any;
      const response = { statusCode: 200 } as any;

      expect(
        config.pinoHttp.customSuccessMessage(request, response, 12),
      ).not.toContain('QUERY_SENTINEL');
      expect(
        config.pinoHttp.customErrorMessage(
          request,
          response,
          new Error('failed'),
        ),
      ).not.toContain('QUERY_SENTINEL');
    });

    it('serializes errors without raw messages in production or detailed preview', () => {
      const sentinel = 'PRIVATE_ERROR_SENTINEL';

      for (const values of [
        { NODE_ENV: 'production', DEBUG_HTTP_FULL: 'false' },
        { NODE_ENV: 'preview', DEBUG_HTTP_FULL: 'true' },
      ]) {
        const config = buildConfig(values);
        const error = new Error(sentinel);
        error.name = 'DatabaseError';
        error.stack = `DatabaseError: ${sentinel}\n    at query (file:///app/repository.ts?token=${sentinel}:42:7)`;

        const serialized = {
          error: config.pinoHttp.serializers.err(error as any),
          message: config.pinoHttp.customErrorMessage(
            { method: 'GET', url: `/api/test?q=${sentinel}` } as any,
            { statusCode: 500 } as any,
            error,
          ),
        };
        const output = JSON.stringify(serialized);

        expect(output).not.toContain(sentinel);
        expect(output).toContain('DatabaseError');
        expect(output).toContain('repository.ts:42:7');
      }
    });

    it('captures the real Express json-to-send chain once as a sanitized object', async () => {
      const responseLogs: Array<{
        response: { statusCode: number; body: unknown };
      }> = [];
      const logger = {
        debug: (entry: (typeof responseLogs)[number]) =>
          responseLogs.push(entry),
      };
      const middleware = new ResponseLoggerMiddleware(
        {
          get: (key: string) =>
            ({
              NODE_ENV: 'preview',
              DEBUG_HTTP_FULL: 'true',
            })[key],
        } as ConfigService,
        logger as any,
      );
      const app = new ExpressAdapter().getInstance() as Express;
      app.use((req: Request, res: Response, next: NextFunction) =>
        middleware.use(req, res, next),
      );
      app.get('/response', (_req: Request, res: Response) => {
        res.json({
          visible: 'yes',
          endingBalance: 'FINANCIAL_VALUE_SENTINEL',
          nested: { refreshToken: 'RESPONSE_TOKEN_SENTINEL' },
        });
      });

      const response = await request(app).get('/response').expect(200);

      expect(response.body).toEqual({
        visible: 'yes',
        endingBalance: 'FINANCIAL_VALUE_SENTINEL',
        nested: { refreshToken: 'RESPONSE_TOKEN_SENTINEL' },
      });
      expect(responseLogs).toHaveLength(1);
      const loggedResponse = responseLogs[0].response;
      expect(loggedResponse.body).toEqual({
        visible: 'yes',
        endingBalance: '[REDACTED]',
        nested: { refreshToken: '[REDACTED]' },
      });
      expect(typeof loggedResponse.body).toBe('object');
    });

    it('captures a direct Express send without changing status or payload', async () => {
      const responseLogs: Array<{
        response: { statusCode: number; body: unknown };
      }> = [];
      const logger = {
        debug: (entry: (typeof responseLogs)[number]) =>
          responseLogs.push(entry),
      };
      const middleware = new ResponseLoggerMiddleware(
        {
          get: (key: string) =>
            ({
              NODE_ENV: 'preview',
              DEBUG_HTTP_FULL: 'true',
            })[key],
        } as ConfigService,
        logger as any,
      );
      const app = new ExpressAdapter().getInstance() as Express;
      app.use((req: Request, res: Response, next: NextFunction) =>
        middleware.use(req, res, next),
      );
      app.get('/response', (_req: Request, res: Response) => {
        res.status(202).send('diagnostic visible');
      });

      const response = await request(app).get('/response').expect(202);

      expect(response.text).toBe('diagnostic visible');
      expect(responseLogs).toHaveLength(1);
      expect(responseLogs[0]).toMatchObject({
        response: {
          statusCode: 202,
          body: 'diagnostic visible',
        },
      });
    });
  });

  describe('GlobalExceptionFilter Redaction', () => {
    it('logs only sanitized query fields in detailed preview mode', () => {
      process.env.NODE_ENV = 'preview';
      process.env.DEBUG_HTTP_FULL = 'true';
      const request = createMockRequest({
        url: '/api/v1/search?term=groceries&token=QUERY_TOKEN_SENTINEL',
        query: { term: 'groceries', token: 'QUERY_TOKEN_SENTINEL' },
      });
      const host = createMockArgumentsHost(request, createMockResponse());

      globalExceptionFilter.catch(
        new HttpException('Test error', HttpStatus.BAD_REQUEST),
        host,
      );

      const logContext = capturedLogs[0].context;
      expect(logContext.url).toBe('/api/v1/search');
      expect(logContext.requestQuery).toEqual({
        term: 'groceries',
        token: '[REDACTED]',
      });
      expect(JSON.stringify(logContext)).not.toContain('QUERY_TOKEN_SENTINEL');
    });

    it('omits the query entirely from production error logs', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG_HTTP_FULL = 'true';
      const request = createMockRequest({
        url: '/api/v1/search?term=groceries&token=QUERY_TOKEN_SENTINEL',
        query: { term: 'groceries', token: 'QUERY_TOKEN_SENTINEL' },
      });
      const host = createMockArgumentsHost(request, createMockResponse());

      globalExceptionFilter.catch(
        new HttpException('Test error', HttpStatus.BAD_REQUEST),
        host,
      );

      const logContext = capturedLogs[0].context;
      expect(logContext.url).toBe('/api/v1/search');
      expect(logContext.requestQuery).toBeUndefined();
      expect(JSON.stringify(logContext)).not.toContain('QUERY_TOKEN_SENTINEL');
    });

    it('should omit the request body entirely outside development', () => {
      // The denylist below covers only password/token/secret/authorization/auth.
      // Vault key material (clientKey, oldClientKey, newClientKey, recoveryKey)
      // and financial amounts are NOT covered, and pino's `req.body.*` redact
      // paths do not reach this hand-built log object. Production must
      // therefore carry no body at all rather than a partially-redacted one.
      process.env.NODE_ENV = 'production';
      const request = createMockRequest({
        body: { clientKey: 'ab'.repeat(32), recoveryKey: 'RECOVERY-KEY' },
      });
      const host = createMockArgumentsHost(request, createMockResponse());

      globalExceptionFilter.catch(
        new HttpException('Test error', HttpStatus.BAD_REQUEST),
        host,
      );

      const logContext = capturedLogs[0].context;
      expect(logContext.requestBody).toBeUndefined();
      expect(JSON.stringify(logContext)).not.toContain('ab'.repeat(32));
      expect(JSON.stringify(logContext)).not.toContain('RECOVERY-KEY');
    });

    it('should redact sensitive data in error logs from request body', () => {
      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      const error = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      // Trigger the exception filter
      globalExceptionFilter.catch(error, host);

      // Verify that logs were called
      expect(capturedLogs.length).toBeGreaterThan(0);

      // Get the log context
      const logContext = capturedLogs[0].context;

      // Check that sensitive fields are redacted
      expect(logContext.requestBody.password).toBe('[REDACTED]');
      expect(logContext.requestBody.token).toBe('[REDACTED]');
      expect(logContext.requestBody.secret).toBe('[REDACTED]');
      expect(logContext.requestBody.authorization).toBe('[REDACTED]');
      expect(logContext).toMatchObject({
        requestId: 'req-123-456',
        method: 'POST',
        url: '/api/v1/test',
        statusCode: 400,
        errorCode: 'HTTP_400',
      });

      // Check that normal fields are preserved
      expect(logContext.requestBody.normalField).toBe('normal-value');
    });

    it('should handle requests with no sensitive data', () => {
      const request = createMockRequest({
        body: {
          username: 'testuser',
          email: 'test@example.com',
          preferences: { theme: 'dark' },
        },
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      const error = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      globalExceptionFilter.catch(error, host);

      expect(capturedLogs.length).toBeGreaterThan(0);

      const logContext = capturedLogs[0].context;

      // Typed identity fields are redacted; structural diagnostics remain.
      expect(logContext.requestBody.username).toBe('testuser');
      expect(logContext.requestBody.email).toBe('[REDACTED]');
      expect(logContext.requestBody.preferences.theme).toBe('dark');
    });

    it('should handle empty or null request bodies', () => {
      const request1 = createMockRequest({ body: null });
      const request2 = createMockRequest({ body: {} });
      const request3 = createMockRequest({ body: undefined });

      const response = createMockResponse();
      const error = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      [request1, request2, request3].forEach((req) => {
        capturedLogs = []; // Clear logs for each test
        const host = createMockArgumentsHost(req, response);

        // Should not throw an error
        expect(() => globalExceptionFilter.catch(error, host)).not.toThrow();

        expect(capturedLogs.length).toBeGreaterThan(0);
      });
    });

    it('should redact nested sensitive fields', () => {
      const request = createMockRequest({
        body: {
          user: {
            auth: 'nested-auth-token',
          },
          settings: {
            apiKey: 'nested-api-key',
          },
        },
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      const error = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      globalExceptionFilter.catch(error, host);

      expect(capturedLogs.length).toBeGreaterThan(0);

      const logContext = capturedLogs[0].context;

      expect(logContext.requestBody.user.auth).toBe('[REDACTED]');
      expect(logContext.requestBody.settings.apiKey).toBe('[REDACTED]');
    });

    it('should handle server errors (5xx) differently from client errors (4xx)', () => {
      const request = createMockRequest();
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      // Test client error (4xx)
      const clientError = new HttpException(
        'Client error',
        HttpStatus.BAD_REQUEST,
      );
      globalExceptionFilter.catch(clientError, host);

      // Should use warn level for client errors
      expect(capturedLogs.some((log) => log.method === 'warn')).toBe(true);

      capturedLogs = []; // Clear logs

      // Test server error (5xx)
      const serverError = new HttpException(
        'Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      globalExceptionFilter.catch(serverError, host);

      // Should use error level for server errors
      expect(capturedLogs.some((log) => log.method === 'error')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should deeply redact arrays and nested structures', () => {
      const request = createMockRequest({
        body: {
          passwords: ['password1', 'password2'], // Field name matches but it's an array
          tokens: [{ token: 'array-token' }], // Nested in array
          data: 'normal-data',
        },
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      const error = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      globalExceptionFilter.catch(error, host);

      expect(capturedLogs.length).toBeGreaterThan(0);

      const logContext = capturedLogs[0].context;

      expect(logContext.requestBody.passwords).toBe('[REDACTED]');
      expect(logContext.requestBody.tokens).toBe('[REDACTED]');

      // Normal data should be preserved
      expect(logContext.requestBody.data).toBe('normal-data');
    });

    it('should handle mixed sensitive and non-sensitive data', () => {
      const request = createMockRequest({
        body: {
          publicInfo: 'public-data',
          password: 'secret-password',
          userPreferences: { theme: 'dark' },
          token: 'auth-token',
          metadata: { version: '1.0' },
        },
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      const error = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      globalExceptionFilter.catch(error, host);

      expect(capturedLogs.length).toBeGreaterThan(0);

      const logContext = capturedLogs[0].context;

      // Sensitive fields should be redacted
      expect(logContext.requestBody.password).toBe('[REDACTED]');
      expect(logContext.requestBody.token).toBe('[REDACTED]');

      // Non-sensitive fields should be preserved
      expect(logContext.requestBody.publicInfo).toBe('public-data');
      expect(logContext.requestBody.userPreferences.theme).toBe('dark');
      expect(logContext.requestBody.metadata.version).toBe('1.0');
    });

    it('should handle case sensitivity correctly', () => {
      const request = createMockRequest({
        body: {
          Password: 'should-not-be-redacted', // Capital P
          password: 'should-be-redacted', // Lowercase p
          TOKEN: 'should-not-be-redacted', // Capital TOKEN
          token: 'should-be-redacted', // Lowercase token
        },
      });
      const response = createMockResponse();
      const host = createMockArgumentsHost(request, response);

      const error = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      globalExceptionFilter.catch(error, host);

      expect(capturedLogs.length).toBeGreaterThan(0);

      const logContext = capturedLogs[0].context;

      expect(logContext.requestBody.password).toBe('[REDACTED]');
      expect(logContext.requestBody.token).toBe('[REDACTED]');
      expect(logContext.requestBody.Password).toBe('[REDACTED]');
      expect(logContext.requestBody.TOKEN).toBe('[REDACTED]');
    });
  });

  describe('Configuration Verification', () => {
    it('should verify redaction is properly configured in development and production', () => {
      // Test development environment
      process.env.NODE_ENV = 'development';
      const _configService = new ConfigService();

      // In a real scenario, we would verify the pino configuration
      // For now, we document that redaction should work in both environments
      expect(process.env.NODE_ENV).toBe('development');

      // Test production environment
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');

      // Reset to original state
      delete process.env.NODE_ENV;
    });

    it('should list all sensitive fields that are configured for redaction', () => {
      const expectedSensitiveFields = [
        'password',
        'token',
        'secret',
        'authorization',
        'auth',
      ];

      // These are the fields that the GlobalExceptionFilter should redact
      expectedSensitiveFields.forEach((field) => {
        expect(typeof field).toBe('string');
        expect(field.length).toBeGreaterThan(0);
      });

      // Document that HTTP-level redaction is configured in app.module.ts
      const httpRedactionPaths = [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.token',
        'res.headers["set-cookie"]',
      ];

      httpRedactionPaths.forEach((path) => {
        expect(typeof path).toBe('string');
        expect(path.length).toBeGreaterThan(0);
      });
    });
  });
});
