import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { AccountDeletionService } from './account-deletion.service';
import { ACCOUNT_DELETION_REPOSITORY } from './domain/ports/account-deletion-repository.port';
import { SupabaseAccountDeletionRepository } from './infrastructure/persistence/supabase-account-deletion.repository';

@Module({
  imports: [SupabaseModule],
  providers: [
    AccountDeletionService,
    {
      provide: ACCOUNT_DELETION_REPOSITORY,
      useClass: SupabaseAccountDeletionRepository,
    },
    createInfoLoggerProvider(AccountDeletionService.name),
    createInfoLoggerProvider(SupabaseAccountDeletionRepository.name),
  ],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
