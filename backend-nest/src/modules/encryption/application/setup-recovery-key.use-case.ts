import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';

@Injectable()
export class SetupRecoveryKeyUseCase {
  constructor(
    private readonly cryptoService: AesGcmCryptoService,
    @InjectInfoLogger(SetupRecoveryKeyUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    clientKey: Buffer,
  ): Promise<{ recoveryKey: string }> {
    const { formatted } = await this.cryptoService.createRecoveryKey(
      userId,
      clientKey,
    );

    this.logger.info(
      { userId, operation: 'recovery_key.create' },
      'Recovery key created',
    );

    return { recoveryKey: formatted };
  }
}
