import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

@Injectable()
export class ResponseLoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const debugHttpFull =
      this.configService.get<string>('DEBUG_HTTP_FULL') === 'true';

    if (!debugHttpFull) {
      return next();
    }

    // Store the original methods
    const originalSend = res.send;
    const originalJson = res.json;

    // Override json method
    res.json = function (body: unknown) {
      res.locals.responseBody = body;
      return originalJson.call(this, body);
    };

    // Override send method
    res.send = function (body: unknown) {
      res.locals.responseBody = body;
      return originalSend.call(this, body);
    };

    // Log response after it's sent
    res.on('finish', () => {
      if (res.locals.responseBody) {
        this.logger.debug({
          response: {
            statusCode: res.statusCode,
            body: res.locals.responseBody,
          },
          msg: 'Response body',
        });
      }
    });

    next();
  }
}
