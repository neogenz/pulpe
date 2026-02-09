import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpBlacklistMiddleware implements NestMiddleware {
  readonly #blacklistedIps: Set<string>;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(IpBlacklistMiddleware.name)
    private readonly logger: PinoLogger,
  ) {
    const raw = this.configService.get<string>('IP_BLACKLIST', '');
    this.#blacklistedIps = new Set(
      raw
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean),
    );

    if (this.#blacklistedIps.size > 0) {
      this.logger.info(
        `IP blacklist loaded: ${this.#blacklistedIps.size} entries`,
      );
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (this.#blacklistedIps.size === 0) return next();

    const clientIp = this.#extractIp(req);

    if (clientIp && this.#blacklistedIps.has(clientIp)) {
      this.logger.warn(
        { ip: clientIp, url: req.url },
        'Blocked blacklisted IP',
      );
      return res.status(403).json({
        statusCode: 403,
        code: 'IP_BLOCKED',
        message: 'Access denied.',
      });
    }

    return next();
  }

  #extractIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return first?.split(',')[0]?.trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return req.ip;
  }
}
