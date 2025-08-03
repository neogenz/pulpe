import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

// Custom serializers for domain objects
export const customSerializers = {
  // Serialize user objects to avoid exposing sensitive data
  user: (
    user: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) => {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email?.replace(/^(.{2}).*(@.*)$/, '$1***$2'), // Partial email masking
      role: user.role,
    };
  },

  // Serialize budget objects
  budget: (
    budget: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) => {
    if (!budget) return null;
    return {
      id: budget.id,
      year: budget.year,
      month: budget.month,
      status: budget.status,
      totalAmount: budget.total_amount,
    };
  },

  // Serialize transaction objects
  transaction: (
    transaction: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) => {
    if (!transaction) return null;
    return {
      id: transaction.id,
      type: transaction.transaction_type,
      amount: transaction.amount,
      date: transaction.transaction_date,
      categoryId: transaction.budget_line_id,
    };
  },

  // Enhanced error serializer
  err: (
    err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) => {
    if (!err) return null;

    const serialized: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ =
      {
        type: err.constructor?.name || 'Error',
        message: err.message,
        code: err.code,
        statusCode: err.statusCode || err.status,
      };

    // Include stack trace in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      serialized.stack = err.stack;
    }

    // Include additional error properties
    if (err.response) {
      serialized.response = {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
      };
    }

    return serialized;
  },

  // Serialize request objects with more details
  req: (
    req: IncomingMessage & {
      id?: string;
      user?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
      body?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
      query?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
      params?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
    },
  ) => {
    return {
      id: req.id,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      remoteAddress: req.socket?.remoteAddress,
      remotePort: req.socket?.remotePort,
      // Include body size for monitoring
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
      // Include query parameters (be careful with sensitive data)
      query: req.query,
      params: req.params,
    };
  },

  // Serialize response objects
  res: (res: ServerResponse & { statusCode: number }) => {
    return {
      statusCode: res.statusCode,
      headers: res.getHeaders(),
    };
  },
};

// Async hooks for performance tracking
export const asyncHooksConfig = {
  enabled: process.env.ENABLE_ASYNC_HOOKS === 'true',
  // Track long-running operations
  longOperationThreshold: 1000, // 1 second
};

// Log level configuration per environment
export const getLogLevel = (configService: ConfigService): string => {
  const env = configService.get<string>('NODE_ENV', 'development');
  const customLevel = configService.get<string>('LOG_LEVEL');

  if (customLevel) return customLevel;

  switch (env) {
    case 'production':
      return 'info';
    case 'staging':
      return 'debug';
    case 'test':
      return 'error';
    default:
      return 'debug';
  }
};

// Create Pino configuration factory
export function createPinoConfig(configService: ConfigService): Params {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const logLevel = getLogLevel(configService);

  return {
    pinoHttp: {
      level: logLevel,

      // Custom request ID generation
      genReqId: (
        req: IncomingMessage & {
          headers: Record<string, string | string[] | undefined>;
          id?: string;
        },
      ) => {
        // Use existing request ID if available
        if (req.id) return req.id;

        const headerValue =
          req.headers['x-request-id'] || req.headers['x-correlation-id'];
        if (headerValue) {
          return Array.isArray(headerValue) ? headerValue[0] : headerValue;
        }

        return randomUUID();
      },

      // Custom serializers
      serializers: {
        ...customSerializers,
        req: customSerializers.req,
        res: customSerializers.res,
        err: customSerializers.err,
      },

      // Redact sensitive fields
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.body.password',
          'req.body.token',
          'req.body.refreshToken',
          'req.body.creditCard',
          'res.headers["set-cookie"]',
          '*.password',
          '*.token',
          '*.secret',
          '*.apiKey',
        ],
        censor: '[REDACTED]',
      },

      // Custom log messages
      customLogLevel: (
        req: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
        res: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
        err?: Error,
      ) => {
        if (res.statusCode >= 400 && res.statusCode < 500) {
          return 'warn';
        }
        if (res.statusCode >= 500 || err) {
          return 'error';
        }
        return 'info';
      },

      // Custom success/error messages
      customSuccessMessage: (
        req: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
        res: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
      ) => {
        return `${req.method} ${req.url} completed`;
      },

      customErrorMessage: (
        req: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
        res: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
        err: Error,
      ) => {
        return `${req.method} ${req.url} failed: ${err.message}`;
      },

      // Transport configuration
      transport: isProduction
        ? undefined // Use default stdout in production
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              levelFirst: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss.l',
              ignore: 'pid,hostname',
              messageFormat: '{module} | {msg}',
              errorLikeObjectKeys: ['err', 'error'],
              sync: true, // Bun compatibility
            },
          },

      // Auto logging configuration
      autoLogging: {
        ignore: (req: IncomingMessage & { url?: string }) => {
          // Ignore health checks and metrics endpoints
          const ignoredPaths = ['/health', '/metrics', '/favicon.ico'];
          return ignoredPaths.some((path) => req.url?.includes(path)) ?? false;
        },
      },

      // Custom attributes to add to every log
      customProps: (
        req: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
        res: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
      ) => ({
        environment: configService.get<string>('NODE_ENV'),
        version: configService.get<string>('APP_VERSION', '1.0.0'),
        service: 'pulpe-budget-api',
      }),

      // Slow request threshold
      slowReqThreshold: isProduction ? 3000 : 1000,
    },

    // Rename context to module for better organization
    renameContext: 'module',

    // Use existing logger instance
    useExisting: true,

    // Format destination (for production)
    ...(isProduction && {
      formatters: {
        level: (label: string) => ({ level: label }),
        log: (
          obj: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
        ) => {
          // Add ECS (Elastic Common Schema) fields for better log aggregation
          return {
            ...obj,
            '@timestamp': new Date().toISOString(),
            'service.name': 'pulpe-budget-api',
            'service.version': configService.get<string>(
              'APP_VERSION',
              '1.0.0',
            ),
            'service.environment': configService.get<string>('NODE_ENV'),
          };
        },
      },
    }),
  };
}

// Log sampling configuration for high-volume operations
export interface SamplingConfig {
  [operation: string]: number; // Sample rate between 0 and 1
}

export const defaultSamplingConfig: SamplingConfig = {
  'health.check': 0.01, // 1% sampling for health checks
  'metrics.collect': 0.1, // 10% sampling for metrics
  'transaction.list': 0.5, // 50% sampling for list operations
  'budget.calculate': 1, // 100% sampling for important calculations
};

// Performance monitoring configuration
export interface PerformanceConfig {
  enabled: boolean;
  slowOperationThreshold: number;
  criticalOperationThreshold: number;
  samplingRate: number;
}

export const getPerformanceConfig = (
  configService: ConfigService,
): PerformanceConfig => ({
  enabled: configService.get<boolean>('PERFORMANCE_MONITORING_ENABLED', true),
  slowOperationThreshold: configService.get<number>(
    'SLOW_OPERATION_THRESHOLD',
    1000,
  ),
  criticalOperationThreshold: configService.get<number>(
    'CRITICAL_OPERATION_THRESHOLD',
    5000,
  ),
  samplingRate: configService.get<number>('PERFORMANCE_SAMPLING_RATE', 1),
});
