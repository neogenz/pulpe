import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { z } from 'zod';
import {
  OAuthClientInformationFullSchema,
  type OAuthClientInformationFull,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { TableRows } from '@/types/supabase-helpers';
import type { NewMcpConnection } from '../../domain/mcp-connection.entity';

const privateSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
});
const grantSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  client_id: z.string().min(1),
  generation: z.uuid(),
  encrypted_upstream: z.string().min(1),
  grant_expires_at: z.iso.datetime({ offset: true }),
});
const refreshClaimSchema = z.object({
  token_id: z.uuid(),
  connection: grantSchema,
});
export type McpOAuthGrant = z.infer<typeof grantSchema>;
type Session = z.infer<typeof privateSessionSchema>;
type Authorization = TableRows<'mcp_oauth_authorization'>;
type TokenPair = { accessHash: string; refreshHash: string; expiresAt: string };

export const hashMcpCredential = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** Credential storage only. Financial repositories still use the owner's RLS session. */
@Injectable()
export class SupabaseMcpOAuthRepository {
  readonly #key: Buffer;

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    const key = Buffer.from(
      config.getOrThrow<string>('MCP_WRAPPING_KEY'),
      'hex',
    );
    if (key.length !== 32) throw new Error('MCP_WRAPPING_KEY must be 32 bytes');
    this.#key = Buffer.from(
      hkdfSync('sha256', key, Buffer.alloc(0), 'pulpe-mcp-oauth-v1', 32),
    );
    key.fill(0);
  }

  async getClient(id: string): Promise<OAuthClientInformationFull | undefined> {
    const { data, error } = await this.#db
      .from('mcp_oauth_client')
      .select('encrypted_metadata')
      .eq('id', id)
      .maybeSingle();
    this.#check(error);
    if (!data) return undefined;
    return OAuthClientInformationFullSchema.parse(
      this.#open(data.encrypted_metadata, ['client', id]),
    );
  }

  async saveClient(client: OAuthClientInformationFull): Promise<void> {
    const { error } = await this.#db.from('mcp_oauth_client').insert({
      id: client.client_id,
      encrypted_metadata: this.#seal(client, ['client', client.client_id]),
    });
    this.#check(error);
  }

  async createAuthorization(
    clientId: string,
    params: AuthorizationParams,
    resource: string,
  ): Promise<string> {
    const { data, error } = await this.#db
      .from('mcp_oauth_authorization')
      .insert({
        client_id: clientId,
        redirect_uri: params.redirectUri,
        resource,
        challenge: params.codeChallenge,
        state: params.state ?? null,
      })
      .select('id')
      .single();
    this.#check(error);
    return data!.id;
  }

  async pending(id: string): Promise<Authorization | null> {
    if (!z.uuid().safeParse(id).success) return null;
    const { data, error } = await this.#db
      .from('mcp_oauth_authorization')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    this.#check(error);
    return data;
  }

  async decide(
    id: string,
    status: 'approving' | 'denied',
  ): Promise<Authorization | null> {
    if (!z.uuid().safeParse(id).success) return null;
    const { data, error } = await this.#db
      .from('mcp_oauth_authorization')
      .update({ status })
      .eq('id', id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .select('*')
      .maybeSingle();
    this.#check(error);
    return data;
  }

  async complete(
    id: string,
    grant: NewMcpConnection,
    session: Session,
    generation: string,
    codeHash: string,
  ): Promise<boolean> {
    const { data, error } = await this.#db.rpc(
      'mcp_oauth_complete_authorization',
      {
        p_id: id,
        p_user_id: grant.userId,
        p_client_name: grant.clientName,
        p_mode: grant.mode,
        p_wrapped_key: grant.wrappedClientKey,
        p_upstream: this.sealSession(
          session,
          grant.userId,
          grant.clientId,
          generation,
        ),
        p_code_hash: codeHash,
        p_generation: generation,
      },
    );
    this.#check(error);
    return typeof data === 'string';
  }

  async forCode(
    hash: string,
    clientId: string,
  ): Promise<{ authorization: Authorization; grant: McpOAuthGrant } | null> {
    const { data, error } = await this.#db
      .from('mcp_oauth_authorization')
      .select('*, mcp_connection!inner(*)')
      .eq('code_hash', hash)
      .eq('client_id', clientId)
      .eq('status', 'authorized')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    this.#check(error);
    if (!data || !this.#active(data.mcp_connection, data.generation))
      return null;
    return {
      authorization: data,
      grant: grantSchema.parse(data.mcp_connection),
    };
  }

  async exchangeCode(
    hash: string,
    clientId: string,
    redirect: string,
    resource: string,
    pair: TokenPair,
  ): Promise<boolean> {
    const { data, error } = await this.#db.rpc('mcp_oauth_exchange_code', {
      p_code_hash: hash,
      p_client_id: clientId,
      p_redirect_uri: redirect,
      p_resource: resource,
      p_access_hash: pair.accessHash,
      p_refresh_hash: pair.refreshHash,
      p_access_expires_at: pair.expiresAt,
    });
    this.#check(error);
    return data === true;
  }

  async claimRefresh(
    hash: string,
    clientId: string,
  ): Promise<z.infer<typeof refreshClaimSchema> | null> {
    const { data, error } = await this.#db.rpc('mcp_oauth_claim_refresh', {
      p_hash: hash,
      p_client_id: clientId,
    });
    this.#check(error);
    return data ? refreshClaimSchema.parse(data) : null;
  }

  async releaseRefresh(tokenId: string): Promise<void> {
    const { error } = await this.#db
      .from('mcp_oauth_token')
      .update({ consumed_at: null })
      .eq('id', tokenId)
      .is('replaced_at', null);
    this.#check(error);
  }

  async finishRefresh(
    tokenId: string,
    grant: McpOAuthGrant,
    session: Session,
    pair: TokenPair,
  ): Promise<boolean> {
    const { data, error } = await this.#db.rpc('mcp_oauth_finish_refresh', {
      p_token_id: tokenId,
      p_upstream: this.sealSession(
        session,
        grant.user_id,
        grant.client_id,
        grant.generation,
      ),
      p_access_hash: pair.accessHash,
      p_refresh_hash: pair.refreshHash,
      p_access_expires_at: pair.expiresAt,
    });
    this.#check(error);
    return data === true;
  }

  async forAccess(
    hash: string,
  ): Promise<{ grant: McpOAuthGrant; expiresAt: number } | null> {
    const { data, error } = await this.#db
      .from('mcp_oauth_token')
      .select('*, mcp_connection!inner(*)')
      .eq('access_hash', hash)
      .is('consumed_at', null)
      .gt('access_expires_at', new Date().toISOString())
      .maybeSingle();
    this.#check(error);
    if (!data || !this.#active(data.mcp_connection, data.generation))
      return null;
    return {
      grant: grantSchema.parse(data.mcp_connection),
      expiresAt: Date.parse(data.access_expires_at) / 1000,
    };
  }

  async revokeToken(hash: string, clientId: string): Promise<void> {
    const { data, error } = await this.#db
      .from('mcp_oauth_token')
      .select('connection_id, generation')
      .or(`access_hash.eq.${hash},refresh_hash.eq.${hash}`)
      .maybeSingle();
    this.#check(error);
    if (!data) return;
    const result = await this.#db
      .from('mcp_connection')
      .update({
        revoked_at: new Date().toISOString(),
        wrapped_client_key: null,
        encrypted_upstream: null,
      })
      .eq('id', data.connection_id)
      .eq('generation', data.generation)
      .eq('client_id', clientId);
    this.#check(result.error);
  }

  async purgeExpired(): Promise<void> {
    const cutoff = new Date().toISOString();
    const results = await Promise.all([
      this.#db
        .from('mcp_oauth_authorization')
        .delete()
        .lt('expires_at', cutoff),
      this.#db
        .from('mcp_oauth_token')
        .delete()
        .lt('refresh_expires_at', cutoff),
    ]);
    results.forEach(({ error }) => this.#check(error));
  }

  readSession(grant: McpOAuthGrant): Session {
    return privateSessionSchema.parse(
      this.#open(grant.encrypted_upstream, [
        'upstream',
        grant.user_id,
        grant.client_id,
        grant.generation,
      ]),
    );
  }

  sealSession(
    session: Session,
    userId: string,
    clientId: string,
    generation: string,
  ): string {
    return this.#seal(session, ['upstream', userId, clientId, generation]);
  }

  #active(
    connection: TableRows<'mcp_connection'>,
    generation: string | null,
  ): boolean {
    return (
      connection.generation === generation &&
      connection.revoked_at === null &&
      !!connection.wrapped_client_key &&
      !!connection.encrypted_upstream &&
      !!connection.grant_expires_at &&
      Date.parse(connection.grant_expires_at) > Date.now()
    );
  }

  #seal(value: unknown, context: string[]): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(context)));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64',
    );
  }

  #open(value: string, context: string[]): unknown {
    const payload = Buffer.from(value, 'base64');
    if (payload.length < 29) throw new Error('Invalid MCP credential payload');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.#key,
      payload.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(JSON.stringify(context)));
    decipher.setAuthTag(payload.subarray(12, 28));
    const plaintext = Buffer.concat([
      decipher.update(payload.subarray(28)),
      decipher.final(),
    ]);
    try {
      return JSON.parse(plaintext.toString('utf8'));
    } finally {
      plaintext.fill(0);
    }
  }

  get #db() {
    return this.supabase.getServiceRoleClient();
  }

  #check(error: unknown): void {
    if (error)
      throw new BusinessException(
        ERROR_DEFINITIONS.MCP_CONNECTION_OPERATION_FAILED,
        undefined,
        { operation: 'mcpOAuth.store' },
        { cause: error },
      );
  }
}
