import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { SupabaseService } from '@modules/supabase/supabase.service';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { isAccessMode } from '../../domain/access-mode';
import type { NewMcpConnection } from '../../domain/mcp-connection.entity';
import type {
  ActiveMcpConnection,
  McpConnectionRepositoryPort,
} from '../../domain/ports/mcp-connection-repository.port';

/** `mcp_connection` is service_role only: the row is the authorization, the JWT only authenticates. */
@Injectable()
export class SupabaseMcpConnectionRepository implements McpConnectionRepositoryPort {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findActive(
    userId: string,
    clientId: string,
  ): Promise<ActiveMcpConnection | null> {
    const { data, error } = await this.supabaseService
      .getServiceRoleClient()
      .from('mcp_connection')
      .select('mode, wrapped_client_key')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('revoked_at', null)
      .maybeSingle();
    // A lookup failure reads as "no grant": the guard answers 401, never 500.
    if (error || !data || !isAccessMode(data.mode)) return null;
    return {
      clientId,
      mode: data.mode,
      clientKey: this.encryption.unwrapSecret(data.wrapped_client_key),
    };
  }

  async save(connection: NewMcpConnection): Promise<void> {
    const { error } = await this.supabaseService
      .getServiceRoleClient()
      .from('mcp_connection')
      .upsert(
        {
          user_id: connection.userId,
          client_id: connection.clientId,
          client_name: connection.clientName,
          mode: connection.mode,
          wrapped_client_key: connection.wrappedClientKey,
          authorized_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: 'user_id,client_id' },
      );
    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.MCP_CONNECTION_SAVE_FAILED,
        undefined,
        { operation: 'mcpConnection.save', userId: connection.userId },
        { cause: error },
      );
    }
  }
}
