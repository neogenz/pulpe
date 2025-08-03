import {
  Injectable,
  NestMiddleware,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate payload size limits for bulk operations.
 * Prevents memory exhaustion attacks by limiting request body size.
 */
@Injectable()
export class PayloadSizeMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Default to 1MB limit for bulk operations
    const maxSize = this.configService.get<number>(
      'BULK_OPERATIONS_MAX_PAYLOAD_SIZE',
      1048576,
    );

    // Check if this is a bulk operations endpoint
    const isBulkOperation = req.path.includes('/bulk-operations');

    if (isBulkOperation && req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length']);

      if (contentLength > maxSize) {
        throw new PayloadTooLargeException(
          `Payload size (${contentLength} bytes) exceeds maximum allowed size (${maxSize} bytes) for bulk operations`,
        );
      }
    }

    next();
  }
}
