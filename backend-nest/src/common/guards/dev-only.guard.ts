import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

/**
 * Guard that restricts endpoint access to development environments only
 *
 * Blocks access when NODE_ENV is 'production' or 'preview'
 * Allows access in 'development' and 'test' environments
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

    if (nodeEnv === 'production' || nodeEnv === 'preview') {
      const request = context.switchToHttp().getRequest();
      this.logger.warn(
        { nodeEnv, path: request.url, method: request.method },
        'Development-only endpoint accessed in production-like environment',
      );
      throw new ForbiddenException(
        'This endpoint is only available in development mode',
      );
    }

    return true;
  }
}
