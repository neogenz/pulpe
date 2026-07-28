import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { resolveHttpLoggingDecision } from '@config/environment';
import { sanitizeLogValue } from '@common/utils/log-anonymization';

@Injectable()
export class ResponseLoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const loggingDecision = resolveHttpLoggingDecision({
      NODE_ENV: this.configService.get<string>('NODE_ENV'),
      DEBUG_HTTP_FULL: this.configService.get<string>('DEBUG_HTTP_FULL'),
      RAILWAY_ENVIRONMENT_NAME: this.configService.get<string>(
        'RAILWAY_ENVIRONMENT_NAME',
      ),
    });
    if (loggingDecision.mode !== 'detailed') {
      return next();
    }

    // Store the original methods
    const originalSend = res.send;
    const originalJson = res.json;
    let responseCaptured = false;

    // Override json method
    res.json = function (body: unknown) {
      res.locals.responseBody = sanitizeLogValue(body);
      responseCaptured = true;
      return originalJson.call(this, body);
    };

    // Override send method
    res.send = function (body: unknown) {
      if (!responseCaptured) {
        res.locals.responseBody = sanitizeLogValue(body);
      }
      return originalSend.call(this, body);
    };

    // Log response after it's sent
    res.on('finish', () => {
      if (res.locals.responseBody !== undefined) {
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
