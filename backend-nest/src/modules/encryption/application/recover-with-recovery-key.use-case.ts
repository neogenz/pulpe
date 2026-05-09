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
    if (error instanceof BusinessException) {
      throw error;
    }

    if (error instanceof Error && this.#isRecoveryKeyError(error)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.RECOVERY_KEY_INVALID,
        undefined,
        { userId, operation: 'recovery.failed' },
        { cause: error },
      );
    }

    throw new BusinessException(
      ERROR_DEFINITIONS.ENCRYPTION_REKEY_FAILED,
      undefined,
      { userId, operation: 'recovery.failed' },
      { cause: error },
    );
  }

  #isRecoveryKeyError(error: Error): boolean {
    return RECOVERY_KEY_ERROR_SIGNATURES.some((signature) =>
      error.message.includes(signature),
    );
  }
}

const RECOVERY_KEY_ERROR_SIGNATURES = [
  'No recovery key configured',
  'Invalid recovery key',
  'Invalid base32 character',
  'Unsupported state or unable to authenticate',
  'Unwrapped DEK has invalid length',
] as const;
