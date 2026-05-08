import { Injectable } from '@nestjs/common';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';

@Injectable()
export class VerifyRecoveryKeyUseCase {
  constructor(private readonly cryptoService: AesGcmCryptoService) {}

  execute(userId: string, recoveryKey: string): Promise<void> {
    return this.cryptoService.verifyRecoveryKey(userId, recoveryKey);
  }
}
