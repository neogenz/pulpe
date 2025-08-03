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
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

// Common Modules
import { DebugModule } from '@modules/debug/debug.module';
import { HealthModule } from '@modules/health/health.module';
import { SupabaseModule } from '@modules/supabase/supabase.module';

// Vertical Slices - New Architecture
import { AuthModule } from '@slices/auth';
import { BudgetSliceModule } from '@slices/budgets';
import { BudgetLineModule } from '@slices/budget-lines';
import { BudgetTemplateModule } from '@slices/budget-templates/infrastructure';
import { TransactionSliceModule } from '@slices/transactions';
import { UserSliceModule } from '@slices/users';

// Filters
import { FiltersModule } from '@common/filters/filters.module';

// Security
import { SecurityModule } from '@shared/infrastructure/security';

// Logging
import {
  LoggingModule,
  LoggingMiddleware,
  CorrelationIdMiddleware,
  createPinoConfig,
} from '@shared/infrastructure/logging';

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
      useFactory: createPinoConfig,
    }),
    LoggingModule,
    SecurityModule, // Security module must be imported early for global guards
    SupabaseModule,
    // Common Modules
    HealthModule,
    DebugModule,
    FiltersModule,
    // Vertical Slices - New Architecture
    AuthModule,
    BudgetSliceModule,
    BudgetLineModule,
    BudgetTemplateModule,
    TransactionSliceModule,
    UserSliceModule,
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
    // Apply correlation ID middleware first
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');

    // Then apply enhanced logging middleware
    consumer.apply(LoggingMiddleware).forRoutes('*');

    // Keep the original HTTP logger for backward compatibility
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
