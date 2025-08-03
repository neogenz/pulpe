import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthController } from './infrastructure/api/auth.controller';
import { SupabaseAuthRepository } from './infrastructure/persistence/supabase-auth.repository';
import { AuthMapper } from './infrastructure/mappers/auth.mapper';
import { AuthHandlers } from './application/handlers';
import { AUTH_REPOSITORY_TOKEN } from './domain/repositories/auth.repository';

@Module({
  imports: [CqrsModule],
  controllers: [AuthController],
  providers: [
    // Handlers
    ...AuthHandlers,

    // Repository
    {
      provide: AUTH_REPOSITORY_TOKEN,
      useClass: SupabaseAuthRepository,
    },

    // Mapper
    AuthMapper,
  ],
  exports: [AUTH_REPOSITORY_TOKEN],
})
export class AuthModule {}
