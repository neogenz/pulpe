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
  McpConnectionSummary,
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
    const { data, error } = await this.#table()
      .select('id, mode, wrapped_client_key')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('revoked_at', null)
      .maybeSingle();
    // A lookup failure reads as "no grant": the guard answers 401, never 500.
    if (error || !data?.wrapped_client_key || !isAccessMode(data.mode)) {
      return null;
    }
    return {
      id: data.id,
      clientId,
      mode: data.mode,
      clientKey: this.encryption.unwrapSecret(data.wrapped_client_key),
    };
  }

  async listActive(userId: string): Promise<McpConnectionSummary[]> {
    const { data, error } = await this.#table()
      .select('id, client_name, mode, authorized_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('authorized_at', { ascending: false });
    if (error) this.#fail('mcpConnection.list', userId, error);
    return (data ?? []).flatMap((row) =>
      isAccessMode(row.mode)
        ? [
            {
              id: row.id,
              clientName: row.client_name,
              mode: row.mode,
              authorizedAt: row.authorized_at,
            },
          ]
        : [],
    );
  }

  async save(connection: NewMcpConnection): Promise<void> {
    const { error } = await this.#table().upsert(
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
    if (error) this.#fail('mcpConnection.save', connection.userId, error);
  }

  async revoke(userId: string, connectionId?: string): Promise<string[]> {
    let query = this.#table()
      .update({
        revoked_at: new Date().toISOString(),
        wrapped_client_key: null,
      })
      .eq('user_id', userId)
      .is('revoked_at', null);
    if (connectionId) query = query.eq('id', connectionId);
    const { data, error } = await query.select('client_id');
    if (error) this.#fail('mcpConnection.revoke', userId, error);
    return (data ?? []).map((row) => row.client_id);
  }

  #table() {
    return this.supabaseService.getServiceRoleClient().from('mcp_connection');
  }

  #fail(operation: string, userId: string, cause: unknown): never {
    throw new BusinessException(
      ERROR_DEFINITIONS.MCP_CONNECTION_OPERATION_FAILED,
      undefined,
      { operation, userId },
      { cause },
    );
  }
}
