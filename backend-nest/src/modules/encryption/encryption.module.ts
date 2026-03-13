import { Global, Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { EncryptionService } from './encryption.service';
import { EncryptionKeyRepository } from './encryption-key.repository';
import { EncryptionController } from './encryption.controller';

@Global()
@Module({
  controllers: [EncryptionController],
  providers: [
    EncryptionService,
    EncryptionKeyRepository,
    createInfoLoggerProvider(EncryptionService.name),
    createInfoLoggerProvider(EncryptionController.name),
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
