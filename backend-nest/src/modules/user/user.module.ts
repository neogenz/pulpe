import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { McpRevocationModule } from '@modules/mcp/mcp-revocation.module';
import { UserController } from './infrastructure/http/user.controller';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { SupabaseUserRepository } from './infrastructure/persistence/supabase-user.repository';
import { GetUserProfileUseCase } from './application/get-user-profile.use-case';
import { UpdateUserProfileUseCase } from './application/update-user-profile.use-case';
import { GetUserSettingsUseCase } from './application/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from './application/update-user-settings.use-case';
import { ScheduleAccountDeletionUseCase } from './application/schedule-account-deletion.use-case';

@Module({
  imports: [SupabaseModule, McpRevocationModule],
  controllers: [UserController],
  providers: [
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    GetUserSettingsUseCase,
    UpdateUserSettingsUseCase,
    ScheduleAccountDeletionUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: SupabaseUserRepository,
    },
    createInfoLoggerProvider(SupabaseUserRepository.name),
    createInfoLoggerProvider(UpdateUserProfileUseCase.name),
    createInfoLoggerProvider(UpdateUserSettingsUseCase.name),
    createInfoLoggerProvider(ScheduleAccountDeletionUseCase.name),
  ],
  // Le module objectif lit la devise du compte pour proposer une origine de
  // retrait dans la bonne unité (PUL-329).
  exports: [USER_REPOSITORY],
})
export class UserModule {}
