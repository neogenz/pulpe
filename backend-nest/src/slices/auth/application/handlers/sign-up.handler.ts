import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { SignUpCommand } from '../commands/sign-up.command';
import {
  AUTH_REPOSITORY_TOKEN,
  type AuthRepository,
} from '../../domain/repositories/auth.repository';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { UserSignedUpEvent } from '../../domain/events/user-signed-up.event';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@Injectable()
@CommandHandler(SignUpCommand)
export class SignUpHandler implements ICommandHandler<SignUpCommand> {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SignUpHandler.name);
  }

  async execute(command: SignUpCommand): Promise<Result<AuthSession>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'sign-up.start',
      email: command.email,
    });

    try {
      // Sign up the user
      const result = await this.authRepository.signUp({
        email: command.email,
        password: command.password,
        firstName: command.firstName,
        lastName: command.lastName,
      });

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'sign-up.failed',
          email: command.email,
          error: result.error?.message || 'Unknown error',
          duration,
        });
        return result;
      }

      const authSession = result.value;

      // Update device info if provided
      if (command.ipAddress || command.userAgent) {
        authSession.updateDeviceInfo(command.ipAddress, command.userAgent);
      }

      // Emit domain event
      const event = new UserSignedUpEvent(
        authSession.userId,
        authSession.email,
        new Date(),
      );
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'sign-up.success',
        userId: authSession.userId,
        email: authSession.email,
        duration,
      });

      return Result.ok(authSession);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'sign-up.error',
        email: command.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to sign up user',
          'SIGN_UP_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
