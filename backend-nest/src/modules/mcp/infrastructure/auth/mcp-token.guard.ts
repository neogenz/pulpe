import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { resolvePayDayOfMonth } from '@common/utils/pay-day';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { SupabaseClient } from '@/types/supabase-helpers';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import {
  MCP_CONNECTION_REPOSITORY,
  type ActiveMcpConnection,
  type McpConnectionRepositoryPort,
} from '../../mcp.tokens';

/** RFC 9728, path-suffixed form: `<origin>/.well-known/oauth-protected-resource/mcp`. */
export function protectedResourceMetadataUrl(resourceUrl: string): string {
  const { origin, pathname } = new URL(resourceUrl);
  return `${origin}/.well-known/oauth-protected-resource${pathname.replace(/\/$/, '')}`;
}

export interface McpRequest extends Request {
  user?: AuthenticatedUser;
  supabase?: SupabaseClient;
  mcpConnection?: ActiveMcpConnection;
}

/**
 * Decoded Supabase JWT payload. The OAuth 2.1 server adds `client_id`;
 * `aud` stays `authenticated` unless a token hook sets the resource URL.
 */
export interface SupabaseTokenClaims {
  client_id?: unknown;
  aud?: unknown;
}

export function decodeJwtClaims(token: string): SupabaseTokenClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * A token is ours when it was issued to an OAuth client (`client_id` present)
 * and every audience it names is either Supabase's default or this server.
 */
export function isMcpAudience(
  claims: SupabaseTokenClaims,
  resourceUrl: string,
): boolean {
  if (typeof claims.client_id !== 'string' || !claims.client_id) return false;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  // `every` answers true on an empty array: a token naming no audience at
  // all would slip through a check that reads as strict.
  if (audiences.length === 0) return false;
  return audiences.every(
    (aud) => aud === 'authenticated' || aud === resourceUrl,
  );
}

/** The REST API must never accept a token minted for an agent. */
export function isAgentToken(token: string): boolean {
  const claims = decodeJwtClaims(token);
  return typeof claims?.client_id === 'string' && claims.client_id !== '';
}

/**
 * Authenticates an agent: signature and expiry via Supabase, audience via
 * claims, authorization via the `mcp_connection` row. Mirrors `AuthGuard`'s
 * CLS contract so existing use cases run unchanged. The bearer never leaves
 * this guard.
 */
@Injectable()
export class McpTokenGuard implements CanActivate {
  readonly #resourceUrl: string;

  constructor(
    @InjectInfoLogger(McpTokenGuard.name)
    private readonly logger: InfoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly cls: ClsService,
    config: ConfigService,
    @Inject(ENCRYPTION_PORT)
    private readonly encryption: EncryptionPort,
    @Inject(MCP_CONNECTION_REPOSITORY)
    private readonly connections: McpConnectionRepositoryPort,
  ) {
    this.#resourceUrl = config.getOrThrow<string>('MCP_RESOURCE_URL');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    const { token, claims } = this.#readBearer(request, response);

    const supabase = this.supabaseService.createAuthenticatedClient(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user || user.app_metadata?.scheduledDeletionAt) {
      throw this.#unauthorized(response, 'token');
    }

    const connection = await this.connections.findActive(
      user.id,
      claims.client_id as string,
    );
    if (!connection) {
      throw this.#unauthorized(response, 'connection');
    }
    // No `request.user` yet: ClientKeyCleanupInterceptor cannot zero this key.
    try {
      await this.encryption.ensureUserDEK(user.id, connection.clientKey);
    } catch {
      connection.clientKey.fill(0);
      throw this.#unauthorized(response, 'vault');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email!,
      firstName: user.user_metadata?.firstName,
      lastName: user.user_metadata?.lastName,
      accessToken: token,
      clientKey: connection.clientKey,
      payDayOfMonth: resolvePayDayOfMonth(user.user_metadata),
    };
    request.user = authenticatedUser;
    request.supabase = supabase;
    request.mcpConnection = connection;
    // `/mcp` sits outside the `api` prefix, so the CLS middleware may not
    // have opened a context: the controller opens one from `request`.
    if (this.cls.isActive()) {
      this.cls.set('user', authenticatedUser);
      this.cls.set('supabase', supabase);
    }
    return true;
  }

  #readBearer(
    request: McpRequest,
    response: Response,
  ): { token: string; claims: SupabaseTokenClaims } {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw this.#unauthorized(response, 'missing token');
    }
    const claims = decodeJwtClaims(token);
    if (!claims || !isMcpAudience(claims, this.#resourceUrl)) {
      throw this.#unauthorized(response, 'audience');
    }
    return { token, claims };
  }

  #unauthorized(response: Response, reason: string): UnauthorizedException {
    this.logger.warn({ reason }, 'MCP request rejected');
    response.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${protectedResourceMetadataUrl(this.#resourceUrl)}"`,
    );
    // One generic message: the reason is logged, never leaked to the caller.
    return new UnauthorizedException('Unauthorized');
  }
}
