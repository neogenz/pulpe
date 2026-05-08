import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { UserController } from './user.controller';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { SupabaseUserRepository } from './infrastructure/persistence/supabase-user.repository';

@Module({
  imports: [SupabaseModule],
  controllers: [UserController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: SupabaseUserRepository,
    },
    createInfoLoggerProvider(UserController.name),
    createInfoLoggerProvider(SupabaseUserRepository.name),
  ],
  exports: [],
})
export class UserModule {}
