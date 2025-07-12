import {
  Injectable,
  Logger,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

// Modules
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { DebugModule } from '@modules/debug/debug.module';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';

// Filters
import { FiltersModule } from '@common/filters/filters.module';

// HTTP Logging Middleware
import { NextFunction, Request, Response } from 'express';

@Injectable()
class HttpLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - start;
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${responseTime}ms`,
      );
    });

    next();
  }
}

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
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        sync: true, // Sync mode for Bun compatibility
        append: false,
      },
    };
  }

  // En production : logs JSON sur stdout pour collecte par l'infrastructure
  return undefined;
}

function createPinoLoggerConfig(configService: ConfigService) {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  return {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
      genReqId: createRequestIdGenerator(),
      redact: {
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
      autoLogging: {
        ignore: (req: IncomingMessage & { url?: string }) =>
          req.url?.includes('/health') ?? false,
      },
    },
    renameContext: 'module',
    useExisting: true as const,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createPinoLoggerConfig,
    }),
    SupabaseModule,
    AuthModule,
    BudgetModule,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
