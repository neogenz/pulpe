import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { SignInCommand } from '../commands/sign-in.command';
import {
  type AuthRepository,
  AUTH_REPOSITORY_TOKEN,
} from '../../domain/repositories/auth.repository';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { UserSignedInEvent } from '../../domain/events/user-signed-in.event';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@Injectable()
@CommandHandler(SignInCommand)
export class SignInHandler implements ICommandHandler<SignInCommand> {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SignInHandler.name);
  }

  async execute(command: SignInCommand): Promise<Result<AuthSession>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'sign-in.start',
      email: command.email,
    });

    try {
      // Sign in the user
      const result = await this.authRepository.signIn({
        email: command.email,
        password: command.password,
      });

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'sign-in.failed',
          email: command.email,
          error: result.error.message,
          duration,
        });
        return result;
      }

      const authSession = result.getValue();

      // Update device info if provided
      if (command.ipAddress || command.userAgent) {
        authSession.updateDeviceInfo(command.ipAddress, command.userAgent);
      }

      // Emit domain event
      const event = new UserSignedInEvent(
        authSession.userId,
        authSession.email,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'sign-in.success',
        userId: authSession.userId,
        email: authSession.email,
        duration,
      });

      return Result.ok(authSession);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'sign-in.error',
        email: command.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to sign in user',
          'SIGN_IN_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
