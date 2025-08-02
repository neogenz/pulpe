import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { CurlGenerator } from 'curl-generator';

// Modules
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
import { DebugModule } from '@modules/debug/debug.module';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';

// Filters
import { FiltersModule } from '@common/filters/filters.module';

// Middleware
import { ResponseLoggerMiddleware } from '@common/middleware/response-logger.middleware';

// Configuration
import { validateConfig } from '@config/environment';

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

function createLoggerTransport(isProduction: boolean) {
  if (!isProduction) {
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

  // En production : logs JSON sur stdout pour collecte par l'infrastructure
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
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const debugHttpFull = configService.get<string>('DEBUG_HTTP_FULL') === 'true';

  return {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
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
      transport: createLoggerTransport(isProduction),
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
      envFilePath: ['.env.local', '.env'],
      cache: true,
      validate: validateConfig,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createPinoLoggerConfig,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 900000, // 15 minutes in milliseconds
        limit: 100, // 100 requests per window
      },
    ]),
    SupabaseModule,
    AuthModule,
    BudgetModule,
    BudgetLineModule,
    BudgetTemplateModule,
    TransactionModule,
    UserModule,
    DebugModule,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ResponseLoggerMiddleware).forRoutes('*');
  }
}
