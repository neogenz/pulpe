import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
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
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{ recoveryKey: string }> {
    const { formatted } = await this.cryptoService.createRecoveryKey(
      userId,
      clientKey,
      supabase,
    );

    this.logger.info(
      { userId, operation: 'recovery_key.create' },
      'Recovery key created',
    );

    return { recoveryKey: formatted };
  }
}
