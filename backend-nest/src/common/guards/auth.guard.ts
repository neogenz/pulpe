import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { Request } from 'express';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { SupabaseClient } from '@/types/supabase-helpers';

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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithCache = context.switchToHttp().getRequest();
    const accessToken = this.extractTokenFromHeader(request);

    if (!accessToken) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_TOKEN_MISSING);
    }

    if (request.__throttlerUserCache) {
      return this.authenticateWithCache(request, accessToken);
    }

    return this.authenticateWithSupabase(request, accessToken);
  }

  private authenticateWithCache(
    request: RequestWithCache,
    accessToken: string,
  ): boolean {
    try {
      const cachedUser = request.__throttlerUserCache!;
      const supabase =
        this.supabaseService.createAuthenticatedClient(accessToken);

      this.logger.debug(
        { userId: cachedUser.id },
        'Reusing cached user from throttler guard',
      );

      const clientKey = this.extractClientKey(request);
      request.user = { ...cachedUser, accessToken, clientKey };
      request.supabase = supabase;
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

      const clientKey = this.extractClientKey(request);

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email!,
        firstName: user.user_metadata?.firstName,
        lastName: user.user_metadata?.lastName,
        accessToken,
        clientKey,
      };

      request.user = authenticatedUser;
      request.supabase = supabase;

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

  private extractClientKey(request: RequestWithCache): Buffer {
    const clientKeyHex = request.headers?.['x-client-key'] as
      | string
      | undefined;

    if (!clientKeyHex) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_MISSING);
    }

    const clientKey = Buffer.from(clientKeyHex, 'hex');
    if (clientKey.length !== 32) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

    if (!clientKey.some((byte) => byte !== 0)) {
      throw new BusinessException(ERROR_DEFINITIONS.AUTH_CLIENT_KEY_INVALID);
    }

    return clientKey;
  }
}
