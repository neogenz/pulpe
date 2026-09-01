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
import type { IncomingMessage, ServerResponse } from 'http';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  DEMO_UNVERIFIED_HOURLY_LIMIT,
  isDemoPath,
  isUnverifiedDemoSessionRequest,
  PUBLIC_THROTTLER_NAME,
} from '@config/throttler.config';

// Modules
import { AppCacheModule } from '@modules/cache/cache.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetLineModule } from '@modules/budget-line/budget-line.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { SavingsGoalModule } from '@modules/savings-goal/savings-goal.module';
import { DebugModule } from '@modules/debug/debug.module';
import { DemoModule } from '@modules/demo/demo.module';
import { EncryptionModule } from '@modules/encryption/encryption.module';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { TagModule } from '@modules/tag/tag.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { CurrencyModule } from '@modules/currency/currency.module';
import { UserModule } from '@modules/user/user.module';
import { AccountDeletionModule } from '@modules/account-deletion/account-deletion.module';
import { AppVersionModule } from '@modules/app-version/app-version.module';
import { WhatsNewModule } from '@modules/whats-new/whats-new.module';
import { AllocationModule } from '@modules/allocation/allocation.module';
import { FeedbackModule } from '@modules/feedback/feedback.module';

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
import {
  isProductionLike,
  resolveHttpLoggingDecision,
  validateConfig,
} from '@config/environment';
import { ScheduleModule } from '@nestjs/schedule';

// Utils
import {
  anonymizeIp,
  parseDeviceType,
  sanitizeLogTechnicalValue,
  sanitizeLogValue,
  sanitizeStackFrames,
  toLogPath,
} from '@common/utils/log-anonymization';
import { createRequestIdGenerator } from '@common/utils/request-id';

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
        id: req.id,
        method: req.method,
        url: toLogPath(req.url),
        headers: sanitizeLogValue(req.headers),
        body: sanitizeLogValue(req.body),
        query: sanitizeLogValue(req.query),
        params: sanitizeLogValue(req.params),
      };
    },
    res: (
      res: ServerResponse & {
        statusCode?: number;
        headers?: Record<string, string | string[] | undefined>;
      },
    ) => ({
      statusCode: res.statusCode,
      headers: sanitizeLogValue(res.headers),
    }),
    err: serializeError,
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
      id: req.id,
      method: req.method,
      url: toLogPath(req.url),
      deviceType: parseDeviceType(req.headers?.['user-agent'] as string),
      ip: anonymizeIp(
        (req.headers?.['x-forwarded-for'] ||
          req.headers?.['x-real-ip']) as string,
      ),
    }),
    res: (res: ServerResponse & { statusCode?: number }) => ({
      statusCode: res.statusCode,
    }),
    err: serializeError,
  };
}

function serializeError(
  error: Error & { code?: unknown; status?: unknown; statusCode?: unknown },
) {
  return {
    type: sanitizeLogTechnicalValue(error.name) ?? 'Error',
    code: sanitizeLogTechnicalValue(error.code),
    statusCode:
      typeof error.statusCode === 'number'
        ? error.statusCode
        : typeof error.status === 'number'
          ? error.status
          : undefined,
    stackFrames: sanitizeStackFrames(error.stack),
  };
}

export function createPinoLoggerConfig(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV');
  const railwayEnvironmentName = configService.get<string>(
    'RAILWAY_ENVIRONMENT_NAME',
  );
  const productionLike = isProductionLike(nodeEnv, railwayEnvironmentName);
  const loggingDecision = resolveHttpLoggingDecision({
    NODE_ENV: nodeEnv,
    DEBUG_HTTP_FULL: configService.get<string>('DEBUG_HTTP_FULL'),
    RAILWAY_ENVIRONMENT_NAME: railwayEnvironmentName,
  });

  return {
    pinoHttp: {
      level:
        loggingDecision.mode === 'detailed'
          ? 'debug'
          : productionLike
            ? 'info'
            : 'debug',
      genReqId: createRequestIdGenerator(),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-client-key"]',
          'req.body.password',
          'req.body.clientKey',
          'req.body.newClientKey',
          'req.body.recoveryKey',
          'req.body.token',
          'req.body.overallRating',
          'req.body.onboarding',
          'req.body.budgetClarity',
          'req.body.currentMonth',
          'req.body.futurePlanning',
          'req.body.homeClarity',
          'req.body.other',
          'req.body.comment',
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
        return `${req.method} ${toLogPath(req.url)} ${res.statusCode} - ${Math.round(responseTime)}ms`;
      },
      customErrorMessage: (
        req: IncomingMessage & { method?: string; url?: string },
        res: ServerResponse & { statusCode?: number },
        _error: Error,
      ) => {
        return `${req.method} ${toLogPath(req.url)} ${res.statusCode} - request failed`;
      },
      serializers:
        loggingDecision.mode === 'detailed'
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
        const isDev = !isProductionLike(
          nodeEnv,
          config.get<string>('RAILWAY_ENVIRONMENT_NAME'),
        );

        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.get<number>('THROTTLE_TTL', 60000),
              limit: config.get<number>('THROTTLE_LIMIT', 200), // 200 req/min for authenticated users
            },
            {
              // Unauthenticated traffic only. UserThrottlerGuard skips this
              // bucket once the request's token resolves to a real user — a
              // forged `Bearer` header must NOT be enough to leave it.
              name: PUBLIC_THROTTLER_NAME,
              ttl: 60000,
              limit: isDev ? 1000 : 20, // 20 req/min for unauthenticated requests in prod
            },
            {
              name: 'demo',
              ttl: 3600000,
              limit: isDev ? 1000 : 30,
              skipIf: (context: ExecutionContext) =>
                !isDemoPath(
                  context.switchToHttp().getRequest<{ url?: string }>().url,
                ),
            },
            {
              // Tighter per-IP cap for unverified (empty-token) demo creation.
              // See throttler.config.ts for why empty tokens are accepted.
              name: 'demoUnverified',
              ttl: 3600000,
              limit: isDev ? 1000 : DEMO_UNVERIFIED_HOURLY_LIMIT,
              skipIf: (context: ExecutionContext) =>
                !isUnverifiedDemoSessionRequest(context),
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
    SavingsGoalModule,
    TagModule,
    TransactionModule,
    AllocationModule,
    CurrencyModule,
    UserModule,
    AccountDeletionModule,
    AppVersionModule,
    WhatsNewModule,
    FeedbackModule,
    // Only include DebugModule in non-production-like environments
    ...(!isProductionLike() ? [DebugModule] : []),
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
        { path: 'api/v1/app/version', method: RequestMethod.GET },
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
