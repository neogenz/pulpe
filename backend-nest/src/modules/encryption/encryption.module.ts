import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { EncryptionKeyRepository } from './encryption-key.repository';
import { EncryptionController } from './encryption.controller';

@Global()
@Module({
  controllers: [EncryptionController],
  providers: [EncryptionService, EncryptionKeyRepository],
  exports: [EncryptionService],
})
export class EncryptionModule {}
