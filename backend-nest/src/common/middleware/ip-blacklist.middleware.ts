import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Request, Response, NextFunction } from 'express';
import {
  isRailwayProxyTrusted,
  proxyClientIp,
} from '@common/utils/proxy-client-ip';

@Injectable()
export class IpBlacklistMiddleware implements NestMiddleware {
  readonly #blacklistedIps: Set<string>;
  readonly #trustRailwayProxy: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(IpBlacklistMiddleware.name)
    private readonly logger: PinoLogger,
  ) {
    const raw = this.configService.get<string>('IP_BLACKLIST', '');
    this.#trustRailwayProxy = isRailwayProxyTrusted(
      this.configService.get<string>('RAILWAY_ENVIRONMENT_NAME'),
    );
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

  // Trust X-Real-IP only when Railway provenance is explicit. Outside Railway,
  // a client can supply the header and must not be able to bypass the blacklist.
  #extractIp(req: Request): string | undefined {
    return this.#trustRailwayProxy ? (proxyClientIp(req) ?? req.ip) : req.ip;
  }
}
