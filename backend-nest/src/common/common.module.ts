import { Module, Global } from '@nestjs/common';
import { TurnstileService } from './services/turnstile.service';

/**
 * Common module providing shared services across the application
 *
 * This module is marked as Global, so its providers are available
 * throughout the application without needing to import the module
 */
@Global()
@Module({
  providers: [TurnstileService],
  exports: [TurnstileService],
})
export class CommonModule {}
