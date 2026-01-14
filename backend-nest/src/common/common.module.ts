import { Module, Global } from '@nestjs/common';
import { TurnstileService } from './services/turnstile.service';
import { createInfoLoggerProvider } from '@common/logger';

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
    createInfoLoggerProvider(TurnstileService.name),
  ],
  exports: [TurnstileService],
})
export class CommonModule {}
