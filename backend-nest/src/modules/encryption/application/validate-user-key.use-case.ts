import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';

@Injectable()
export class ValidateUserKeyUseCase {
  constructor(
    private readonly cryptoService: AesGcmCryptoService,
    @InjectInfoLogger(ValidateUserKeyUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(userId: string, clientKey: Buffer): Promise<void> {
    const isValid = await this.cryptoService.verifyAndEnsureKeyCheck(
      userId,
      clientKey,
    );

    if (!isValid) {
      this.logger.warn(
        { userId, operation: 'validate_key.failed' },
        'Client key verification failed',
      );
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
      );
    }
  }
}
