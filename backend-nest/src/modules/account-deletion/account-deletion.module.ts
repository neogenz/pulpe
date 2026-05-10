import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { ACCOUNT_DELETION_REPOSITORY } from './domain/ports/account-deletion-repository.port';
import { CleanupExpiredDeletionsUseCase } from './application/cleanup-expired-deletions.use-case';
import { SupabaseAccountDeletionRepository } from './infrastructure/persistence/supabase-account-deletion.repository';
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
    createInfoLoggerProvider(CleanupExpiredDeletionsUseCase.name),
    createInfoLoggerProvider(SupabaseAccountDeletionRepository.name),
  ],
  exports: [],
})
export class AccountDeletionModule {}
