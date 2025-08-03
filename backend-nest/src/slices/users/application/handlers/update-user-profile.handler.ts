import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { UpdateUserProfileCommand } from '../commands/update-user-profile.command';
import {
  USER_REPOSITORY_TOKEN,
  type UserRepository,
} from '../../domain/repositories';
import { UserProfileUpdatedEvent } from '../../domain/events/user-profile-updated.event';

export interface UpdateUserProfileResult {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  updatedAt: Date;
}

@Injectable()
export class UpdateUserProfileHandler {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly repository: UserRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    command: UpdateUserProfileCommand,
  ): Promise<Result<UpdateUserProfileResult>> {
    const context = {
      userId: command.userId,
      hasFirstName: !!command.firstName,
      hasLastName: !!command.lastName,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'UpdateUserProfile',
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

          // Update user profile
          const updateResult = user.updateProfile(
            command.firstName,
            command.lastName,
          );
          if (updateResult.isFail()) {
            return Result.fail(updateResult.error);
          }

          // Save to Supabase Auth
          const saveResult = await this.repository.updateProfile(
            command.userId,
            command.firstName,
            command.lastName,
          );
          if (saveResult.isFail()) {
            return Result.fail(saveResult.error);
          }

          const updatedUser = saveResult.value;

          // Log success
          this.logger.info(
            {
              userId: command.userId,
              firstName: command.firstName,
              lastName: command.lastName,
            },
            'User profile updated successfully',
          );

          // Publish domain event
          const event = new UserProfileUpdatedEvent(command.userId, {
            firstName: command.firstName,
            lastName: command.lastName,
          });
          this.logger.debug({ event }, 'UserProfileUpdatedEvent published');

          const snapshot = updatedUser.toSnapshot();
          return Result.ok<UpdateUserProfileResult>({
            id: snapshot.id,
            email: snapshot.email,
            firstName: snapshot.firstName,
            lastName: snapshot.lastName,
            updatedAt: snapshot.updatedAt,
          });
        } catch {
          this.logger.error(
            { error, context },
            'Failed to update user profile',
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
