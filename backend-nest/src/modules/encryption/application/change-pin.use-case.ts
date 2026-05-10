import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { EncryptionChangePinResponse } from 'pulpe-shared';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';

@Injectable()
export class ChangePinUseCase {
  constructor(
    private readonly cryptoService: AesGcmCryptoService,
    @InjectInfoLogger(ChangePinUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    oldClientKey: Buffer,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<EncryptionChangePinResponse> {
    const result = await this.cryptoService.changePinRekey(
      userId,
      oldClientKey,
      newClientKey,
      supabase,
    );

    this.logger.info(
      {
        userId,
        operation: 'pin_change.complete',
        recoveryKeyRegenerated: true,
      },
      'PIN changed and data re-encrypted',
    );

    return result;
  }
}
