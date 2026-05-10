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
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REKEY_FAILED,
        undefined,
        { userId, operation: 'recovery.failed' },
        { cause: error },
      );
    }

    this.logger.info(
      { userId, operation: 'recovery.complete' },
      'Account recovered with recovery key',
    );
  }
}
