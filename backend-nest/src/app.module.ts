import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

// Modules
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { DebugModule } from '@modules/debug/debug.module';

// Middleware
import { RequestIdMiddleware } from '@common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: process.env.NODE_ENV === 'development' 
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
    TransactionModule,
    UserModule,
    DebugModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('{*path}'); // Use new named parameter syntax
  }
}