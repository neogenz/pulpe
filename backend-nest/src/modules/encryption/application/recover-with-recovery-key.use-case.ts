import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { AesGcmCryptoService } from '../infrastructure/crypto/aes-gcm.crypto-service';
import {
  REVOKE_AGENT_CONNECTIONS_PORT,
  type RevokeAgentConnectionsPort,
} from '@modules/mcp/domain/ports/revoke-agent-connections.port';

@Injectable()
export class RecoverWithRecoveryKeyUseCase {
  constructor(
    private readonly cryptoService: AesGcmCryptoService,
    @Inject(REVOKE_AGENT_CONNECTIONS_PORT)
    private readonly agentConnections: RevokeAgentConnectionsPort,
    @InjectInfoLogger(RecoverWithRecoveryKeyUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    recoveryKey: string,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
    accessToken: string,
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

    // Agents hold wrapped copies of the old key: dead after the rekey.
    await this.agentConnections.revokeAll(userId, accessToken);

    this.logger.info(
      { userId, operation: 'recovery.complete' },
      'Account recovered with recovery key',
    );
  }
}
