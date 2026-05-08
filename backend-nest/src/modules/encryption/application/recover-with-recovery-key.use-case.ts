import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';

@Injectable()
export class RecoverWithRecoveryKeyUseCase {
  constructor(
    private readonly cryptoService: AesGcmCryptoService,
    @InjectInfoLogger(RecoverWithRecoveryKeyUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    recoveryKey: string,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    try {
      await this.cryptoService.recoverWithKey(
        userId,
        recoveryKey,
        newClientKey,
        supabase,
      );
    } catch (error) {
      this.#handleRecoveryError(userId, error);
    }

    this.logger.info(
      { userId, operation: 'recovery.complete' },
      'Account recovered with recovery key',
    );
  }

  #handleRecoveryError(userId: string, error: unknown): never {
    if (error instanceof Error) {
      const isRecoveryKeyError =
        error.message.includes('No recovery key configured') ||
        error.message.includes('Invalid recovery key') ||
        error.message.includes('Invalid base32 character') ||
        error.message.includes('Unsupported state or unable to authenticate') ||
        error.message.includes('Unwrapped DEK has invalid length');

      if (isRecoveryKeyError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.RECOVERY_KEY_INVALID,
          undefined,
          { userId, operation: 'recovery.failed' },
          { cause: error },
        );
      }
    }
    throw error;
  }
}
