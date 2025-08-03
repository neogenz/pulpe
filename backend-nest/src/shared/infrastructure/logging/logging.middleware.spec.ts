import { Test, TestingModule } from '@nestjs/testing';
import {
  LoggingMiddleware,
  CorrelationIdMiddleware,
  RequestWithContext,
} from './logging.middleware';
import { EnhancedLoggerService } from './enhanced-logger.service';
import { PinoLogger } from 'nestjs-pino';
import { Request, Response, NextFunction } from 'express';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let mockPinoLogger: jest.Mocked<PinoLogger>;
  let mockEnhancedLogger: jest.Mocked<EnhancedLoggerService>;
  let mockReq: Partial<RequestWithContext>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    mockPinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    mockEnhancedLogger = {
      logWithContext: jest.fn(),
      logAudit: jest.fn(),
    } as unknown as jest.Mocked<EnhancedLoggerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingMiddleware,
        {
          provide: `PinoLogger:${LoggingMiddleware.name}`,
          useValue: mockPinoLogger,
        },
        {
          provide: EnhancedLoggerService,
          useValue: mockEnhancedLogger,
        },
      ],
    }).compile();

    middleware = module.get<LoggingMiddleware>(LoggingMiddleware);

    // Mock request
    mockReq = {
      method: 'GET',
      originalUrl: '/api/budgets',
      path: '/api/budgets',
      headers: {
        'user-agent': 'test-agent',
        'x-correlation-id': 'test-correlation-123',
      },
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1',
      },
      query: { page: '1' },
      body: {},
      params: {},
    } as Partial<RequestWithContext>;

    // Mock response
    const eventHandlers: { [key: string]: Function[] } = {};
    mockRes = {
      statusCode: 200,
      setHeader: jest.fn(),
      get: jest.fn().mockReturnValue('100'),
      on: jest.fn((event: string, handler: Function) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
      }),
      emit: (event: string, ...args: any[]) => {
        if (eventHandlers[event]) {
          eventHandlers[event].forEach((handler) => handler(...args));
        }
      },
      send: jest.fn(function (body: any) {
        return this;
      }),
      json: jest.fn(function (body: any) {
        return this;
      }),
      status: jest.fn(function (code: number) {
        this.statusCode = code;
        return this;
      }),
    } as unknown as Partial<Response>;

    mockNext = jest.fn();

    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('use', () => {
    it('should set correlation and request IDs', () => {
      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );

      expect(mockReq.correlationId).toBe('test-correlation-123');
      expect(mockReq.id).toBeDefined();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        'test-correlation-123',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        mockReq.id,
      );
    });

    it('should generate correlation ID if not provided', () => {
      delete mockReq.headers!['x-correlation-id'];

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );

      expect(mockReq.correlationId).toBeDefined();
      expect(mockReq.correlationId).toMatch(/^[a-f0-9-]+$/);
    });

    it('should log incoming request', () => {
      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'info',
        'Incoming request',
        expect.objectContaining({
          method: 'GET',
          path: '/api/budgets',
          url: '/api/budgets',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }),
      );
    });

    it('should log successful response completion', () => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1150); // End time

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );

      // Simulate response finish
      (mockRes as any).emit('finish');

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('Request completed'),
        expect.objectContaining({
          statusCode: 200,
          duration: 150,
          responseSize: '100',
        }),
      );
    });

    it('should log error responses with appropriate level', () => {
      mockRes.statusCode = 500;

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );
      (mockRes as any).emit('finish');

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'error',
        expect.any(String),
        expect.objectContaining({
          statusCode: 500,
        }),
      );
    });

    it('should log warning for 4xx responses', () => {
      mockRes.statusCode = 404;

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );
      (mockRes as any).emit('finish');

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'warn',
        expect.any(String),
        expect.objectContaining({
          statusCode: 404,
        }),
      );
    });

    it('should log slow requests', () => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2500); // 1500ms duration

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );
      (mockRes as any).emit('finish');

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('Slow request detected'),
        expect.objectContaining({
          slowRequest: true,
          threshold: 1000,
          duration: 1500,
        }),
      );
    });

    it('should log audit trail for state-changing operations', () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/budgets';
      mockReq.user = { id: 'user123', email: 'test@example.com' };

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );
      (mockRes as any).emit('finish');

      expect(mockEnhancedLogger.logAudit).toHaveBeenCalledWith(
        'POST__API_BUDGETS',
        expect.objectContaining({
          resource: 'api',
          userId: 'user123',
          success: true,
          statusCode: 200,
        }),
        expect.any(Object),
      );
    });

    it('should handle request errors', () => {
      const error = new Error('Request error');

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );
      (mockRes as any).emit('error', error);

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Request error'),
        expect.objectContaining({
          error: {
            message: 'Request error',
            stack: expect.any(String),
          },
        }),
      );
    });

    it('should sanitize sensitive data in request body', () => {
      mockReq.body = {
        username: 'testuser',
        password: 'secret123',
        data: {
          apiKey: 'key123',
          normalField: 'value',
        },
      };

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'info',
        'Incoming request',
        expect.objectContaining({
          body: {
            username: 'testuser',
            password: '[REDACTED]',
            data: {
              apiKey: '[REDACTED]',
              normalField: 'value',
            },
          },
        }),
      );
    });

    it('should sanitize sensitive headers', () => {
      mockReq.headers = {
        ...mockReq.headers,
        authorization: 'Bearer token123',
        cookie: 'session=abc123',
        'x-api-key': 'apikey123',
        'content-type': 'application/json',
      };

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );

      expect(mockEnhancedLogger.logWithContext).toHaveBeenCalledWith(
        'info',
        'Incoming request',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '[REDACTED]',
            cookie: '[REDACTED]',
            'x-api-key': '[REDACTED]',
            'content-type': 'application/json',
          }),
        }),
      );
    });

    it('should extract resource ID from params', () => {
      mockReq.method = 'PUT';
      mockReq.params = { id: 'budget123' };

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );
      (mockRes as any).emit('finish');

      expect(mockEnhancedLogger.logAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          resourceId: 'budget123',
        }),
        expect.any(Object),
      );
    });

    it('should extract resource ID from path', () => {
      mockReq.method = 'DELETE';
      mockReq.path = '/api/budgets/budget456';

      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );
      (mockRes as any).emit('finish');

      expect(mockEnhancedLogger.logAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          resourceId: 'budget456',
        }),
        expect.any(Object),
      );
    });

    it('should call next function', () => {
      middleware.use(
        mockReq as RequestWithContext,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let mockReq: Partial<RequestWithContext>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();

    mockReq = {
      headers: {},
    } as Partial<RequestWithContext>;

    mockRes = {
      setHeader: jest.fn(),
    } as Partial<Response>;

    mockNext = jest.fn();
  });

  it('should use existing correlation ID from headers', () => {
    mockReq.headers!['x-correlation-id'] = 'existing-correlation-123';

    middleware.use(
      mockReq as RequestWithContext,
      mockRes as Response,
      mockNext,
    );

    expect(mockReq.correlationId).toBe('existing-correlation-123');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      'existing-correlation-123',
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should generate new correlation ID if not provided', () => {
    middleware.use(
      mockReq as RequestWithContext,
      mockRes as Response,
      mockNext,
    );

    expect(mockReq.correlationId).toBeDefined();
    expect(mockReq.correlationId).toMatch(/^[a-f0-9-]+$/);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      mockReq.correlationId,
    );
    expect(mockNext).toHaveBeenCalled();
  });
});
