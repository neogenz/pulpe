import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EnhancedLoggerService } from './enhanced-logger.service';

export interface RequestWithContext extends Request {
  id: string;
  correlationId: string;
  startTime: number;
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(
    @InjectPinoLogger(LoggingMiddleware.name)
    private readonly logger: PinoLogger,
    private readonly enhancedLogger: EnhancedLoggerService,
  ) {}

  use(req: RequestWithContext, res: Response, next: NextFunction) {
    // Generate or extract correlation ID
    const correlationId = this.extractCorrelationId(req);
    req.correlationId = correlationId;

    // Generate request ID if not present
    if (!req.id) {
      req.id = randomUUID();
    }

    // Record start time
    req.startTime = Date.now();

    // Set correlation ID in response headers
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Request-Id', req.id);

    // Log request start
    const requestContext = this.buildRequestContext(req);
    this.enhancedLogger.logWithContext(
      'info',
      'Incoming request',
      requestContext,
    );

    // Capture response
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;

    let responseBody: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
    let statusCode: number = 200;

    // Intercept status
    res.status = function (code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Intercept send
    res.send = function (
      body: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    ) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Intercept json
    res.json = function (
      body: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    ) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    // Handle response completion
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      const responseContext = {
        ...requestContext,
        statusCode: res.statusCode,
        duration,
        responseSize: res.get('content-length') || 0,
      };

      // Determine log level based on status code
      let logLevel: 'error' | 'warn' | 'info' = 'info';
      if (res.statusCode >= 500) {
        logLevel = 'error';
      } else if (res.statusCode >= 400) {
        logLevel = 'warn';
      }

      // Log response with appropriate level
      this.enhancedLogger.logWithContext(
        logLevel,
        `Request completed: ${req.method} ${req.originalUrl} - ${res.statusCode} in ${duration}ms`,
        responseContext,
      );

      // Log slow requests
      if (duration > 1000) {
        this.enhancedLogger.logWithContext(
          'warn',
          `Slow request detected: ${req.method} ${req.originalUrl} took ${duration}ms`,
          {
            ...responseContext,
            slowRequest: true,
            threshold: 1000,
          },
        );
      }

      // Audit logging for state-changing operations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        this.logAuditTrail(req, res, responseContext);
      }
    });

    // Handle errors
    res.on('error', (error: Error) => {
      const duration = Date.now() - req.startTime;
      const errorContext = {
        ...requestContext,
        duration,
        error: {
          message: error.message,
          stack: error.stack,
        },
      };

      this.enhancedLogger.logWithContext(
        'error',
        `Request error: ${req.method} ${req.originalUrl} - ${error.message}`,
        errorContext,
      );
    });

    next();
  }

  private extractCorrelationId(req: RequestWithContext): string {
    const correlationHeaders = [
      'x-correlation-id',
      'x-request-id',
      'x-trace-id',
      'x-b3-traceid',
    ];

    for (const header of correlationHeaders) {
      const value = req.headers[header];
      if (value) {
        return Array.isArray(value) ? value[0] : value;
      }
    }

    return randomUUID();
  }

  private buildRequestContext(req: RequestWithContext) {
    return {
      requestId: req.id,
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
      userId: req.user?.id,
      userEmail: req.user?.email,
      query: this.sanitizeObject(req.query),
      body: this.sanitizeObject(req.body),
      headers: this.sanitizeHeaders(req.headers),
    };
  }

  private sanitizeObject(
    obj: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): any /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
      'creditCard',
      'credit_card',
      'ssn',
    ];

    const sanitized: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ =
      Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (
        sensitiveKeys.some((sensitive) =>
          key.toLowerCase().includes(sensitive.toLowerCase()),
        )
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeHeaders(
    headers: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): any /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    const sanitized: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ =
      {};

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private logAuditTrail(
    req: RequestWithContext,
    res: Response,
    context: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) {
    const auditInfo = {
      action: `${req.method}_${req.path.replace(/\//g, '_').toUpperCase()}`,
      resource: this.extractResourceFromPath(req.path),
      resourceId: this.extractResourceId(req),
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
      success: res.statusCode < 400,
      statusCode: res.statusCode,
    };

    this.enhancedLogger.logAudit(auditInfo.action, auditInfo, context);
  }

  private extractResourceFromPath(path: string): string {
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[0];
    }
    return 'unknown';
  }

  private extractResourceId(req: RequestWithContext): string | undefined {
    // Try to extract ID from params
    if (req.params?.id) return req.params.id;

    // Try to extract from path (e.g., /budgets/123 or /api/budgets/123)
    const pathMatch = req.path.match(/\/([a-zA-Z0-9-]+)$/);
    if (pathMatch) return pathMatch[1];

    // Try to extract from body for POST requests
    if (req.method === 'POST' && req.body?.id) {
      return req.body.id;
    }

    return undefined;
  }
}

/**
 * Middleware for adding correlation IDs to async context
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();

    // Store in AsyncLocalStorage if available
    if (global.AsyncLocalStorage) {
      // This would require setting up AsyncLocalStorage in your app
      // For now, we'll just ensure the correlation ID is available
    }

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    next();
  }
}
