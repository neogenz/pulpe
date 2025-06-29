import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

// Modules
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { BudgetTemplateModule } from '@modules/budget-template/budget-template.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { DebugModule } from '@modules/debug/debug.module';

// Middleware
import { RequestIdMiddleware } from '@common/middleware/request-id.middleware';

// Filters
import { FiltersModule } from '@common/filters/filters.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    LoggerModule.forRoot({
      pinoHttp:
        process.env.NODE_ENV === 'development'
          ? {
              level: 'debug',
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname',
                },
              },
            }
          : {
              level: 'info',
              // No transport = standard JSON logging for production
            },
      // Use Pino for all NestJS logs (startup, routes, etc.)
      renameContext: 'module',
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
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
