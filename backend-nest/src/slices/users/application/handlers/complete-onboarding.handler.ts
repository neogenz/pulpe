import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { CompleteOnboardingCommand } from '../commands/complete-onboarding.command';
import {
  USER_REPOSITORY_TOKEN,
  type UserRepository,
} from '../../domain/repositories';
import { UserOnboardingCompletedEvent } from '../../domain/events/user-onboarding-completed.event';

export interface CompleteOnboardingResult {
  success: boolean;
  message: string;
}

@Injectable()
export class CompleteOnboardingHandler {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly repository: UserRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: CompleteOnboardingCommand,
  ): Promise<Result<CompleteOnboardingResult>> {
    const context = {
      userId: command.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'CompleteOnboarding',
      context,
      logFn: async () => {
        try {
          // Get current user
          const userResult = await this.repository.findById(command.userId);
          if (userResult.isFail()) {
            return Result.fail(userResult.error);
          }

          const user = userResult.value;
          if (!user) {
            return Result.fail(
              new GenericDomainException(
                'User not found',
                'USER_NOT_FOUND',
                `User with ID ${command.userId} not found`,
              ),
            );
          }

          // Complete onboarding
          const completeResult = user.completeOnboarding();
          if (completeResult.isFail()) {
            return Result.fail(completeResult.error);
          }

          // Save to Supabase Auth
          const saveResult = await this.repository.completeOnboarding(
            command.userId,
          );
          if (saveResult.isFail()) {
            return Result.fail(saveResult.error);
          }

          // Log success
          this.logger.info(
            {
              userId: command.userId,
              onboardingCompleted: true,
            },
            'User onboarding completed successfully',
          );

          // Publish domain event
          const event = new UserOnboardingCompletedEvent(
            command.userId,
            new Date(),
          );
          this.logger.debug(
            { event },
            'UserOnboardingCompletedEvent published',
          );

          return Result.ok<CompleteOnboardingResult>({
            success: true,
            message: 'Onboarding completed successfully',
          });
        } catch {
          this.logger.error(
            { error, context },
            'Failed to complete user onboarding',
          );
          return Result.fail(
            error instanceof Error
              ? error
              : new Error('Unknown error occurred'),
          );
        }
      },
    });

    return operationResult;
  }
}
