import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { GetCurrentUserQuery } from '../queries/get-current-user.query';
import {
  USER_REPOSITORY_TOKEN,
  type UserRepository,
} from '../../domain/repositories';
import type { UserSnapshot } from '../../domain/entities/user.entity';

@Injectable()
export class GetCurrentUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly repository: UserRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(query: GetCurrentUserQuery): Promise<Result<UserSnapshot>> {
    const context = {
      userId: query.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'GetCurrentUser',
      context,
      logFn: async () => {
        try {
          const result = await this.repository.getCurrentUser();
          if (result.isFail()) {
            return Result.fail(result.error);
          }

          const user = result.value;
          return Result.ok(user.toSnapshot());
        } catch {
          this.logger.error({ error, context }, 'Failed to get current user');
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
