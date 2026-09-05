import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { User } from '@supabase/supabase-js';
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
  auth?: AuthInfo;
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

/** The REST API must never accept a token minted for an agent. */
export function isAgentToken(token: string): boolean {
  const claims = decodeJwtClaims(token);
  return typeof claims?.client_id === 'string' && claims.client_id !== '';
}

/**
 * The SDK middleware verifies the external opaque bearer first. Only the
 * private owner session enters CLS; ordinary repositories keep their RLS.
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

    const { token, userId, clientId, generation } = this.#readBearer(
      request,
      response,
    );

    const supabase = this.supabaseService.createAuthenticatedClient(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (
      error ||
      !user ||
      user.id !== userId ||
      user.app_metadata?.scheduledDeletionAt
    ) {
      throw this.#unauthorized(response, 'token');
    }

    const connection = await this.connections.findActive(
      user.id,
      clientId,
      generation,
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

    this.#attachRequest(request, user, token, connection, supabase);
    return true;
  }

  #attachRequest(
    request: McpRequest,
    user: User,
    token: string,
    connection: ActiveMcpConnection,
    supabase: SupabaseClient,
  ): void {
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
  }

  #readBearer(
    request: McpRequest,
    response: Response,
  ): { token: string; userId: string; clientId: string; generation: string } {
    const auth = request.auth;
    const {
      userId,
      generation,
      upstreamAccessToken: token,
    } = auth?.extra ?? {};
    if (
      !auth ||
      auth.resource?.href !== this.#resourceUrl ||
      !auth.clientId.startsWith('pulpe_') ||
      typeof userId !== 'string' ||
      typeof generation !== 'string' ||
      typeof token !== 'string'
    ) {
      throw this.#unauthorized(response, 'invalid MCP authentication');
    }
    return { token, userId, clientId: auth.clientId, generation };
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
