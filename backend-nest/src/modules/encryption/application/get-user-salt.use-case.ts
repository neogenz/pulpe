import { Injectable } from '@nestjs/common';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';

@Injectable()
export class GetUserSaltUseCase {
  constructor(private readonly cryptoService: AesGcmCryptoService) {}

  execute(
    userId: string,
  ): Promise<{ salt: string; kdfIterations: number; hasRecoveryKey: boolean }> {
    return this.cryptoService.getUserSalt(userId);
  }
}
