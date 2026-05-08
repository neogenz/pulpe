import { Global, Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { EncryptionController } from './encryption.controller';
import { AesGcmCryptoService } from './infrastructure/crypto/aes-gcm.crypto-service';
import { SupabaseEncryptionKeyRepository } from './infrastructure/persistence/supabase-encryption-key.repository';
import { ENCRYPTION_PORT } from './domain/ports/encryption.port';
import { ENCRYPTION_KEY_REPOSITORY } from './domain/ports/encryption-key-repository.port';

@Global()
@Module({
  controllers: [EncryptionController],
  providers: [
    AesGcmCryptoService,
    SupabaseEncryptionKeyRepository,
    { provide: ENCRYPTION_PORT, useExisting: AesGcmCryptoService },
    {
      provide: ENCRYPTION_KEY_REPOSITORY,
      useExisting: SupabaseEncryptionKeyRepository,
    },
    createInfoLoggerProvider(AesGcmCryptoService.name),
    createInfoLoggerProvider(EncryptionController.name),
  ],
  exports: [AesGcmCryptoService, ENCRYPTION_PORT],
})
export class EncryptionModule {}
