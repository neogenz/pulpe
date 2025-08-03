import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import {
  type AuthRepository,
  AUTH_REPOSITORY_TOKEN,
} from '../../domain/repositories/auth.repository';
import { Session } from '../../domain/value-objects/session.value-object';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@Injectable()
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler
  implements ICommandHandler<RefreshTokenCommand>
{
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RefreshTokenHandler.name);
  }

  async execute(command: RefreshTokenCommand): Promise<Result<Session>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'refresh-token.start',
    });

    try {
      // Refresh the token
      const result = await this.authRepository.refreshToken(
        command.refreshToken,
      );

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'refresh-token.failed',
          error: result.error.message,
          duration,
        });
        return result;
      }

      const session = result.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'refresh-token.success',
        userId: session.userId,
        duration,
      });

      return Result.ok(session);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'refresh-token.error',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to refresh token',
          'REFRESH_TOKEN_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
