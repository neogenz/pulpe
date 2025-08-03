import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { SignOutCommand } from '../commands/sign-out.command';
import {
  type AuthRepository,
  AUTH_REPOSITORY_TOKEN,
} from '../../domain/repositories/auth.repository';
import { UserSignedOutEvent } from '../../domain/events/user-signed-out.event';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@Injectable()
@CommandHandler(SignOutCommand)
export class SignOutHandler implements ICommandHandler<SignOutCommand> {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository,
    private readonly eventBus: EventBus,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SignOutHandler.name);
  }

  async execute(command: SignOutCommand): Promise<Result<void>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'sign-out.start',
      userId: command.userId,
    });

    try {
      // Sign out the user
      const result = await this.authRepository.signOut(command.userId);

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'sign-out.failed',
          userId: command.userId,
          error: result.error.message,
          duration,
        });
        return result;
      }

      // Emit domain event
      const event = new UserSignedOutEvent(command.userId, new Date());
      this.eventBus.publish(event);

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'sign-out.success',
        userId: command.userId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'sign-out.error',
        userId: command.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to sign out user',
          'SIGN_OUT_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
