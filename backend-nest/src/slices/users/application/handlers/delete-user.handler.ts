import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { DeleteUserCommand } from '../commands/delete-user.command';
import {
  USER_REPOSITORY_TOKEN,
  type UserRepository,
} from '../../domain/repositories';
import { UserDeletedEvent } from '../../domain/events/user-deleted.event';

export interface DeleteUserResult {
  deleted: boolean;
  message: string;
}

@Injectable()
export class DeleteUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly repository: UserRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(command: DeleteUserCommand): Promise<Result<DeleteUserResult>> {
    const context = {
      userId: command.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'DeleteUser',
      context,
      logFn: async () => {
        try {
          // Get user details before deletion
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

          // Delete the user
          const deleteResult = await this.repository.delete(command.userId);
          if (deleteResult.isFail()) {
            return Result.fail(deleteResult.error);
          }

          // Log success
          this.logger.info(
            {
              userId: command.userId,
              email: user.email,
            },
            'User account deleted successfully',
          );

          // Publish domain event
          const event = new UserDeletedEvent(
            command.userId,
            user.email,
            new Date(),
          );
          this.logger.debug({ event }, 'UserDeletedEvent published');

          return Result.ok<DeleteUserResult>({
            deleted: true,
            message: 'User account deleted successfully',
          });
        } catch {
          this.logger.error(
            { error, context },
            'Failed to delete user account',
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
