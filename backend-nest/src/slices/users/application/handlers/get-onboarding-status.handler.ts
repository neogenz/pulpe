import { Injectable, Inject } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { GetOnboardingStatusQuery } from '../queries/get-onboarding-status.query';
import {
  USER_REPOSITORY_TOKEN,
  type UserRepository,
} from '../../domain/repositories';

export interface OnboardingStatusResult {
  onboardingCompleted: boolean;
  profileComplete: boolean;
  canAccessPremiumFeatures: boolean;
}

@Injectable()
export class GetOnboardingStatusHandler {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly repository: UserRepository,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async execute(
    query: GetOnboardingStatusQuery,
  ): Promise<Result<OnboardingStatusResult>> {
    const context = {
      userId: query.userId,
    };

    const operationResult = await this.logger.logOperation({
      operation: 'GetOnboardingStatus',
      context,
      logFn: async () => {
        try {
          const result = await this.repository.findById(query.userId);
          if (result.isFail()) {
            return Result.fail(result.error);
          }

          const user = result.value;
          if (!user) {
            return Result.ok<OnboardingStatusResult>({
              onboardingCompleted: false,
              profileComplete: false,
              canAccessPremiumFeatures: false,
            });
          }

          return Result.ok<OnboardingStatusResult>({
            onboardingCompleted: user.onboardingCompleted,
            profileComplete: user.isProfileComplete(),
            canAccessPremiumFeatures: user.canAccessPremiumFeatures(),
          });
        } catch {
          this.logger.error(
            { error, context },
            'Failed to get onboarding status',
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
