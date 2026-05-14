import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';

@Injectable()
export class RegenerateRecoveryKeyUseCase {
  constructor(
    private readonly cryptoService: AesGcmCryptoService,
    @InjectInfoLogger(RegenerateRecoveryKeyUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    clientKey: Buffer,
  ): Promise<{ recoveryKey: string }> {
    const { formatted } = await this.cryptoService.regenerateRecoveryKey(
      userId,
      clientKey,
    );

    this.logger.info(
      { userId, operation: 'recovery_key.regenerate' },
      'Recovery key regenerated',
    );

    return { recoveryKey: formatted };
  }
}
