import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to block all requests when maintenance mode is enabled.
 * Returns 503 Service Unavailable with a specific code for frontend detection.
 */
@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const isMaintenanceMode =
      this.configService.get('MAINTENANCE_MODE') === 'true';

    if (isMaintenanceMode) {
      return res.status(503).json({
        statusCode: 503,
        code: 'MAINTENANCE',
        message: 'Application en maintenance — réessaie plus tard',
      });
    }

    return next();
  }
}
