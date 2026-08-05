import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { isProductionLike } from '@config/environment';

/**
 * Guard that restricts endpoint access to development environments only
 *
 * Blocks access on any production-like environment, judged by `NODE_ENV` *and*
 * `RAILWAY_ENVIRONMENT_NAME` — a Railway `preview` deployment left on
 * `NODE_ENV=development` must not expose these endpoints.
 *
 * Usage:
 * @UseGuards(DevOnlyGuard)
 * @Post('debug-endpoint')
 * debugMethod() { ... }
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(DevOnlyGuard.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const railwayEnvironmentName = this.configService.get<string>(
      'RAILWAY_ENVIRONMENT_NAME',
    );

    if (isProductionLike(nodeEnv, railwayEnvironmentName)) {
      const request = context.switchToHttp().getRequest();
      this.logger.warn(
        {
          nodeEnv,
          railwayEnvironmentName,
          path: request.url,
          method: request.method,
        },
        'Development-only endpoint accessed in production-like environment',
      );
      throw new ForbiddenException(
        'This endpoint is only available in development mode',
      );
    }

    return true;
  }
}
