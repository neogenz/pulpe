import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { AccountDeletionService } from './account-deletion.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    AccountDeletionService,
    createInfoLoggerProvider(AccountDeletionService.name),
  ],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
