import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { EncryptionChangePinResponse } from 'pulpe-shared';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';
import {
  REVOKE_AGENT_CONNECTIONS_PORT,
  type RevokeAgentConnectionsPort,
} from '@modules/mcp/domain/ports/revoke-agent-connections.port';

@Injectable()
export class ChangePinUseCase {
  constructor(
    private readonly cryptoService: AesGcmCryptoService,
    @Inject(REVOKE_AGENT_CONNECTIONS_PORT)
    private readonly agentConnections: RevokeAgentConnectionsPort,
    @InjectInfoLogger(ChangePinUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    oldClientKey: Buffer,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
    accessToken: string,
  ): Promise<EncryptionChangePinResponse> {
    const result = await this.cryptoService.changePinRekey(
      userId,
      oldClientKey,
      newClientKey,
      supabase,
    );
    // Agents hold wrapped copies of the old key: dead after the rekey.
    await this.agentConnections.revokeAll(userId, accessToken);

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
