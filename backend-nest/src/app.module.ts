import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

// Modules
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { DebugModule } from '@modules/debug/debug.module';

// Filters
import { FiltersModule } from '@common/filters/filters.module';

// Logger configuration helpers
function createRequestIdGenerator() {
  return (
    req: IncomingMessage & {
      headers: Record<string, string | string[] | undefined>;
    },
    res: ServerResponse,
  ) => {
    const existingId =
      (req as typeof req & { id?: string }).id ?? req.headers['x-request-id'];
    if (existingId) return existingId;
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
        messageFormat: '{req.method} {req.url} {res.statusCode} - {msg}',
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
export class AppModule {}
