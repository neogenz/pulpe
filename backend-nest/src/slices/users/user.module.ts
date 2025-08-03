import { Module } from '@nestjs/common';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';

// Domain
import { USER_REPOSITORY_TOKEN } from './domain/repositories';

// Application - Command Handlers
import { UpdateUserProfileHandler } from './application/handlers/update-user-profile.handler';
import { CompleteOnboardingHandler } from './application/handlers/complete-onboarding.handler';
import { DeleteUserHandler } from './application/handlers/delete-user.handler';

// Application - Query Handlers
import { GetUserHandler } from './application/handlers/get-user.handler';
import { GetCurrentUserHandler } from './application/handlers/get-current-user.handler';
import { GetOnboardingStatusHandler } from './application/handlers/get-onboarding-status.handler';

// Infrastructure
import { UserController } from './infrastructure/api/user.controller';
import { SupabaseUserRepository } from './infrastructure/persistence/supabase-user.repository';
import { UserMapper } from './infrastructure/mappers/user.mapper';

@Module({
  controllers: [UserController],
  providers: [
    // Infrastructure
    UserMapper,
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: SupabaseUserRepository,
    },
    SupabaseUserRepository, // Also provide the concrete class for direct injection
    EnhancedLoggerService,

    // Command Handlers
    UpdateUserProfileHandler,
    CompleteOnboardingHandler,
    DeleteUserHandler,

    // Query Handlers
    GetUserHandler,
    GetCurrentUserHandler,
    GetOnboardingStatusHandler,
  ],
  exports: [USER_REPOSITORY_TOKEN, UserMapper],
})
export class UserSliceModule {}
