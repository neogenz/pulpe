import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { AuthenticatedSupabaseProvider } from './authenticated-supabase.provider';

@Global()
@Module({
  providers: [SupabaseService, AuthenticatedSupabaseProvider],
  exports: [SupabaseService, AuthenticatedSupabaseProvider],
})
export class SupabaseModule {}
