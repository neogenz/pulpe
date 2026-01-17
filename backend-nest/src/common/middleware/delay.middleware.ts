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
    const isProduction = process.env.NODE_ENV === 'production';
    this.delayMs = isProduction ? 0 : parseInt(process.env.DELAY_MS || '0', 10);
  }

  use(_req: Request, _res: Response, next: NextFunction): void {
    if (this.delayMs === 0) {
      next();
      return;
    }
    setTimeout(next, this.delayMs);
  }
}
