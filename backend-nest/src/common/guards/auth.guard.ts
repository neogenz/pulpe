import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { Request } from 'express';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { SupabaseClient } from '@/types/supabase-helpers';
import { SKIP_CLIENT_KEY } from '@common/decorators/skip-client-key.decorator';
import type { AppClsStore } from '@common/types/cls-store.interface';

interface RequestWithCache extends Request {
  __throttlerUserCache?: AuthenticatedUser | null;
  user?: AuthenticatedUser;
  supabase?: SupabaseClient;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectInfoLogger(AuthGuard.name)
    private readonly logger: InfoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipClientKey = this.reflector.getAllAndOverride<boolean>(
      SKIP_CLIENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request: RequestWithCache = context.switchToHttp().getRequest();
    const accessToken = this.extractTokenFromHeader(request);

    if (!accessToken) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_TOKEN_MISSING);
    }

    if (request.__throttlerUserCache) {
      return this.authenticateWithCache(request, accessToken, skipClientKey);
    }

    return this.authenticateWithSupabase(request, accessToken, skipClientKey);
  }

  private authenticateWithCache(
    request: RequestWithCache,
    accessToken: string,
    skipClientKey: boolean,
  ): boolean {
    try {
      const cachedUser = request.__throttlerUserCache!;
      const supabase =
        this.supabaseService.createAuthenticatedClient(accessToken);

      this.logger.debug(
        { userId: cachedUser.id },
        'Reusing cached user from throttler guard',
      );

      const clientKey = this.#resolveClientKey(request, skipClientKey);
      request.user = { ...cachedUser, accessToken, clientKey };
      request.supabase = supabase;

      // Store isDemo in CLS for encryption service
      this.cls.set('isDemo', cachedUser.isDemo === true);

      return true;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_UNAUTHORIZED);
    }
  }

  private async authenticateWithSupabase(
    request: RequestWithCache,
    accessToken: string,
    skipClientKey: boolean,
  ): Promise<boolean> {
    try {
      const supabase =
        this.supabaseService.createAuthenticatedClient(accessToken);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new BusinessException(ERROR_DEFINITIONS.AUTH_TOKEN_INVALID);
      }

      if (user.user_metadata?.scheduledDeletionAt) {
        throw new BusinessException(ERROR_DEFINITIONS.USER_ACCOUNT_BLOCKED);
      }

      const clientKey = this.#resolveClientKey(request, skipClientKey);

      const isDemo = user.user_metadata?.is_demo === true;

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email!,
        firstName: user.user_metadata?.firstName,
        lastName: user.user_metadata?.lastName,
        accessToken,
        clientKey,
        isDemo,
      };

      request.user = authenticatedUser;
      request.supabase = supabase;

      // Store isDemo in CLS for encryption service
      this.cls.set('isDemo', isDemo);

      return true;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_UNAUTHORIZED);
    }
  }

  private extractTokenFromHeader(request: {
    headers?: { authorization?: string };
  }): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  #resolveClientKey(request: RequestWithCache, skipClientKey: boolean): Buffer {
    return skipClientKey
      ? Buffer.alloc(32, 0)
      : this.#extractClientKey(request);
  }

  #extractClientKey(request: RequestWithCache): Buffer {
    const clientKeyHex = request.headers?.['x-client-key'] as
      | string
      | undefined;

    const metadata = {
      userAgent: request.headers?.['user-agent'],
      ip: request.ip,
    };

    if (!clientKeyHex) {
      this.logger.warn(metadata, 'Missing X-Client-Key header');
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_MISSING);
    }

    const clientKey = Buffer.from(clientKeyHex, 'hex');
    if (clientKey.length !== 32) {
      this.logger.warn(metadata, 'X-Client-Key is not 32 bytes');
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

    if (clientKey.every((byte) => byte === 0)) {
      this.logger.warn(metadata, 'X-Client-Key is all zeros');
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

    return clientKey;
  }
}
