import { Global, Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { EncryptionController } from './encryption.controller';
import { EncryptionService } from './encryption.service';
import { SupabaseEncryptionKeyRepository } from './infrastructure/persistence/supabase-encryption-key.repository';
import { ENCRYPTION_PORT } from './domain/ports/encryption.port';
import { ENCRYPTION_KEY_REPOSITORY } from './domain/ports/encryption-key-repository.port';

@Global()
@Module({
  controllers: [EncryptionController],
  providers: [
    EncryptionService,
    SupabaseEncryptionKeyRepository,
    { provide: ENCRYPTION_PORT, useExisting: EncryptionService },
    {
      provide: ENCRYPTION_KEY_REPOSITORY,
      useExisting: SupabaseEncryptionKeyRepository,
    },
    createInfoLoggerProvider(EncryptionService.name),
    createInfoLoggerProvider(EncryptionController.name),
  ],
  exports: [EncryptionService, ENCRYPTION_PORT],
})
export class EncryptionModule {}
