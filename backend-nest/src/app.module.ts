import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { CurlGenerator } from 'curl-generator';
import type { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

// Modules
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { DebugModule } from '@modules/debug/debug.module';
import { DemoModule } from '@modules/demo/demo.module';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';

// Filters
import { FiltersModule } from '@common/filters/filters.module';

// Common
import { CommonModule } from '@common/common.module';

// Guards
import { ThrottlerGuard } from '@nestjs/throttler';

// Middleware
import { PayloadSizeMiddleware } from '@common/middleware/payload-size.middleware';
import { ResponseLoggerMiddleware } from '@common/middleware/response-logger.middleware';

// Configuration
import { isProductionLike, validateConfig } from '@config/environment';
import { ScheduleModule } from '@nestjs/schedule';

// Logger configuration helpers
function createRequestIdGenerator() {
  return (
    req: IncomingMessage & {
      headers: Record<string, string | string[] | undefined>;
    },
    res: ServerResponse,
  ) => {
    const reqId = (req as typeof req & { id?: string }).id;
    if (reqId) return reqId;

    const headerValue = req.headers['x-request-id'];
    if (headerValue) {
      const existingId = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue;
      if (existingId) return existingId;
    }

    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  };
}

function createLoggerTransport(isProdLike: boolean) {
  if (!isProdLike) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    };
  }

  // En production-like : logs JSON sur stdout pour collecte par l'infrastructure
  return undefined;
}

function createCurlCommand(
  req: IncomingMessage & {
    method?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
    body?: unknown;
  },
) {
  const headers = Object.fromEntries(
    Object.entries(req.headers || {})
      .filter(([k]) => !['host', 'connection', 'content-length'].includes(k))
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || '']),
  );

  return CurlGenerator({
    url: `http://localhost:3000${req.url}`,
    method: (req.method || 'GET') as
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'DELETE'
      | 'PATCH'
      | 'get'
      | 'post'
      | 'put'
      | 'patch'
      | 'delete',
    headers,
    body: req.body as string | Record<string, unknown> | undefined,
  });
}

function createDebugSerializers() {
  return {
    req: (
      req: IncomingMessage & {
        method?: string;
        url?: string;
        headers?: Record<string, string | string[] | undefined>;
        body?: unknown;
        query?: unknown;
        params?: unknown;
      },
    ) => {
      return {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        query: req.query,
        params: req.params,
        curl: createCurlCommand(req),
      };
    },
    res: (
      res: ServerResponse & {
        statusCode?: number;
        headers?: Record<string, string | string[] | undefined>;
      },
    ) => ({
      statusCode: res.statusCode,
      headers: res.headers,
    }),
  };
}

function createProductionSerializers() {
  return {
    req: (
      req: IncomingMessage & {
        method?: string;
        url?: string;
        headers?: Record<string, string | string[] | undefined>;
      },
    ) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers?.['user-agent'],
      ip: req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'],
    }),
    res: (res: ServerResponse & { statusCode?: number }) => ({
      statusCode: res.statusCode,
    }),
  };
}

function createPinoLoggerConfig(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV');
  const productionLike = isProductionLike(nodeEnv);
  const debugHttpFull = configService.get<string>('DEBUG_HTTP_FULL') === 'true';

  return {
    pinoHttp: {
      level: productionLike ? 'info' : 'debug',
      genReqId: createRequestIdGenerator(),
      redact: debugHttpFull
        ? undefined
        : {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.token',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
      transport: createLoggerTransport(productionLike),
      autoLogging: true,
      customSuccessMessage: (
        req: IncomingMessage & { method?: string; url?: string },
        res: ServerResponse & { statusCode?: number },
        responseTime: number,
      ) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${Math.round(responseTime)}ms`;
      },
      customErrorMessage: (
        req: IncomingMessage & { method?: string; url?: string },
        res: ServerResponse & { statusCode?: number },
        error: Error,
      ) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${error.message}`;
      },
      serializers: debugHttpFull
        ? createDebugSerializers()
        : createProductionSerializers(),
    },
    renameContext: 'module',
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env.local',
        '.env',
      ],
      cache: true,
      validate: validateConfig,
    }),
    CommonModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createPinoLoggerConfig,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV');
        const isDev = !isProductionLike(nodeEnv);

        return [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL', 60000), // Default: 1 minute
            limit: config.get<number>('THROTTLE_LIMIT', 1000), // 1000 requests per minute (same in dev/prod for authenticated users)
          },
          {
            name: 'demo',
            ttl: 3600000, // 1 hour in milliseconds
            limit: isDev ? 1000 : 30, // No limit in dev, 30 requests per hour in prod
          },
        ];
      },
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    DemoModule,
    BudgetModule,
    BudgetLineModule,
    BudgetTemplateModule,
    TransactionModule,
    UserModule,
    // Only include DebugModule in non-production-like environments
    ...(!isProductionLike(process.env.NODE_ENV) ? [DebugModule] : []),
    FiltersModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ResponseLoggerMiddleware,
    PayloadSizeMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ResponseLoggerMiddleware).forRoutes('*');
    consumer.apply(PayloadSizeMiddleware).forRoutes('*');
  }
}
