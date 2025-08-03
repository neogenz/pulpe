import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { EnhancedLoggerService } from './enhanced-logger.service';
import {
  LoggingMiddleware,
  CorrelationIdMiddleware,
} from './logging.middleware';
import { createPinoConfig } from './pino.config';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createPinoConfig,
    }),
  ],
  providers: [
    EnhancedLoggerService,
    LoggingMiddleware,
    CorrelationIdMiddleware,
  ],
  exports: [EnhancedLoggerService, LoggingMiddleware, CorrelationIdMiddleware],
})
export class LoggingModule {}
