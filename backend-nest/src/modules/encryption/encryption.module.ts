import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { EncryptionKeyRepository } from './encryption-key.repository';
import { EncryptionRekeyService } from './encryption-rekey.service';
import { EncryptionController } from './encryption.controller';

@Global()
@Module({
  controllers: [EncryptionController],
  providers: [
    EncryptionService,
    EncryptionKeyRepository,
    EncryptionRekeyService,
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
