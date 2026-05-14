import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { ACCOUNT_DELETION_REPOSITORY } from './domain/ports/account-deletion-repository.port';
import { POSTHOG_PERSON_DELETION_PORT } from './domain/ports/posthog-person-deletion.port';
import { CleanupExpiredDeletionsUseCase } from './application/cleanup-expired-deletions.use-case';
import { SupabaseAccountDeletionRepository } from './infrastructure/persistence/supabase-account-deletion.repository';
import { HttpPostHogPersonDeletionAdapter } from './infrastructure/posthog/http-posthog-person-deletion.adapter';
import { AccountDeletionCron } from './infrastructure/scheduler/account-deletion.cron';

@Module({
  imports: [SupabaseModule],
  providers: [
    CleanupExpiredDeletionsUseCase,
    AccountDeletionCron,
    {
      provide: ACCOUNT_DELETION_REPOSITORY,
      useClass: SupabaseAccountDeletionRepository,
    },
    {
      provide: POSTHOG_PERSON_DELETION_PORT,
      useClass: HttpPostHogPersonDeletionAdapter,
    },
    createInfoLoggerProvider(CleanupExpiredDeletionsUseCase.name),
    createInfoLoggerProvider(SupabaseAccountDeletionRepository.name),
    createInfoLoggerProvider(HttpPostHogPersonDeletionAdapter.name),
  ],
  exports: [],
})
export class AccountDeletionModule {}
