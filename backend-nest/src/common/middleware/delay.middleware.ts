import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Development-only middleware that adds artificial delay to all requests.
 * Useful for testing loading states and progress indicators.
 *
 * Set DELAY_MS environment variable to control delay (default: 500ms).
 */
@Injectable()
export class DelayMiddleware implements NestMiddleware {
  private readonly delayMs: number;

  constructor() {
    this.delayMs = parseInt(process.env.DELAY_MS || '500', 10);
  }

  use(_req: Request, _res: Response, next: NextFunction): void {
    setTimeout(next, this.delayMs);
  }
}
