import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { SupabaseService } from './supabase.service';
import { AuthenticatedSupabaseProvider } from './authenticated-supabase.provider';

@Global()
@Module({
  imports: [ClsModule],
  providers: [SupabaseService, AuthenticatedSupabaseProvider],
  exports: [SupabaseService, AuthenticatedSupabaseProvider],
})
export class SupabaseModule {}
