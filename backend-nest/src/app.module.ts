import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { CurlGenerator } from 'curl-generator';
import type { IncomingMessage, ServerResponse } from 'http';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

// Modules
import { AppCacheModule } from '@modules/cache/cache.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { DebugModule } from '@modules/debug/debug.module';
import { DemoModule } from '@modules/demo/demo.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { AccountDeletionModule } from '@modules/account-deletion/account-deletion.module';

// Filters
import { FiltersModule } from '@common/filters/filters.module';

// Common
import { CommonModule } from '@common/common.module';

// Guards
import { UserThrottlerGuard } from '@common/guards/user-throttler.guard';

// Interceptors
import { ClientKeyCleanupInterceptor } from '@common/interceptors/client-key-cleanup.interceptor';

// Middleware
import { DelayMiddleware } from '@common/middleware/delay.middleware';
import { IpBlacklistMiddleware } from '@common/middleware/ip-blacklist.middleware';
import { MaintenanceMiddleware } from '@common/middleware/maintenance.middleware';
import { PayloadSizeMiddleware } from '@common/middleware/payload-size.middleware';
import { ResponseLoggerMiddleware } from '@common/middleware/response-logger.middleware';

// Configuration
import { isProductionLike, validateConfig } from '@config/environment';
import { ScheduleModule } from '@nestjs/schedule';

// Utils
import { anonymizeIp, parseDeviceType } from '@common/utils/log-anonymization';

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
      deviceType: parseDeviceType(req.headers?.['user-agent'] as string),
      ip: anonymizeIp(
        (req.headers?.['x-forwarded-for'] ||
          req.headers?.['x-real-ip']) as string,
      ),
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
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
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
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createPinoLoggerConfig,
    }),
    CommonModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV');
        const isDev = !isProductionLike(nodeEnv);

        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.get<number>('THROTTLE_TTL', 60000),
              limit: config.get<number>('THROTTLE_LIMIT', 200), // 200 req/min for authenticated users
            },
            {
              name: 'public',
              ttl: 60000,
              limit: isDev ? 1000 : 20, // 20 req/min for unauthenticated requests in prod
              skipIf: (context: ExecutionContext) => {
                const request = context
                  .switchToHttp()
                  .getRequest<{ headers?: Record<string, string> }>();
                const auth = request?.headers?.authorization;
                return !!auth && auth.startsWith('Bearer ');
              },
            },
            {
              name: 'demo',
              ttl: 3600000,
              limit: isDev ? 1000 : 30,
              skipIf: (context: ExecutionContext) => {
                const request = context
                  .switchToHttp()
                  .getRequest<{ url?: string }>();
                return !request?.url?.startsWith('/api/v1/demo');
              },
            },
          ],
        };
      },
    }),
    ScheduleModule.forRoot(),
    AppCacheModule,
    SupabaseModule,
    EncryptionModule,
    AuthModule,
    DemoModule,
    BudgetModule,
    BudgetLineModule,
    BudgetTemplateModule,
    TransactionModule,
    UserModule,
    AccountDeletionModule,
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
      useClass: UserThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ClientKeyCleanupInterceptor,
    },
    MaintenanceMiddleware,
    ResponseLoggerMiddleware,
    PayloadSizeMiddleware,
    DelayMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpBlacklistMiddleware).forRoutes('*');
    consumer
      .apply(MaintenanceMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: '/', method: RequestMethod.GET },
        { path: 'api/v1/maintenance/status', method: RequestMethod.GET },
      )
      .forRoutes('*');
    consumer.apply(ResponseLoggerMiddleware).forRoutes('*');
    consumer.apply(PayloadSizeMiddleware).forRoutes('*');

    // Development-only: add artificial delay to test loading states
    if (process.env.DELAY_MS) {
      consumer.apply(DelayMiddleware).forRoutes('*');
    }
  }
}
