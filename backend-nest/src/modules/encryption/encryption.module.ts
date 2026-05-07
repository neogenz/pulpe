import { Global, Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { EncryptionController } from './encryption.controller';
import { EncryptionService } from './encryption.service';
import { EncryptionKeyRepository } from './encryption-key.repository';
import { ENCRYPTION_PORT } from './domain/ports/encryption.port';

@Global()
@Module({
  controllers: [EncryptionController],
  providers: [
    EncryptionService,
    EncryptionKeyRepository,
    { provide: ENCRYPTION_PORT, useExisting: EncryptionService },
    createInfoLoggerProvider(EncryptionService.name),
    createInfoLoggerProvider(EncryptionController.name),
  ],
  exports: [EncryptionService, ENCRYPTION_PORT],
})
export class EncryptionModule {}
