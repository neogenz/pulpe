import { Module, Global } from '@nestjs/common';
import { TurnstileService } from './services/turnstile.service';
import { AuthGuard } from './guards/auth.guard';
import { createInfoLoggerProvider, INFO_LOGGER_TOKEN } from '@common/logger';

/**
 * Common module providing shared services across the application
 *
 * This module is marked as Global, so its providers are available
 * throughout the application without needing to import the module
 */
@Global()
@Module({
  providers: [
    TurnstileService,
    AuthGuard,
    createInfoLoggerProvider(TurnstileService.name),
    createInfoLoggerProvider(AuthGuard.name),
  ],
  exports: [
    TurnstileService,
    AuthGuard,
    `${INFO_LOGGER_TOKEN}:${TurnstileService.name}`,
    `${INFO_LOGGER_TOKEN}:${AuthGuard.name}`,
  ],
})
export class CommonModule {}
