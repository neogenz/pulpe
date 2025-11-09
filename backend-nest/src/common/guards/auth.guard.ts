import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

/**
 * Request object with optional throttler cache
 * UserThrottlerGuard (global) may populate this before AuthGuard runs
 */
interface RequestWithCache extends Record<string, any> {
  __throttlerUserCache?: AuthenticatedUser | null;
  user?: AuthenticatedUser;
  supabase?: any;
  headers?: { authorization?: string };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(AuthGuard.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithCache = context.switchToHttp().getRequest();
    const accessToken = this.extractTokenFromHeader(request);

    if (!accessToken) {
      throw new UnauthorizedException("Token d'accès requis");
    }

    // Performance optimization: Reuse user resolved by UserThrottlerGuard (global guard)
    // UserThrottlerGuard runs first and caches user in __throttlerUserCache
    // This eliminates the 3rd redundant Supabase auth.getUser() call
    if (request.__throttlerUserCache) {
      try {
        const cachedUser = request.__throttlerUserCache;
        const supabase =
          this.supabaseService.createAuthenticatedClient(accessToken);

        this.logger.debug(
          { userId: cachedUser.id },
          'Reusing cached user from throttler guard',
        );

        request.user = cachedUser;
        request.supabase = supabase;
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        this.logger.error(
          { err: error },
          'Authentication error while using cached user',
        );
        throw new UnauthorizedException("Erreur d'authentification");
      }
    }

    // Fallback: If cache miss (shouldn't happen with UserThrottlerGuard enabled),
    // perform normal authentication flow
    try {
      const supabase =
        this.supabaseService.createAuthenticatedClient(accessToken);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new UnauthorizedException("Token d'accès invalide ou expiré");
      }

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email!,
        firstName: user.user_metadata?.firstName,
        lastName: user.user_metadata?.lastName,
      };

      request.user = authenticatedUser;
      request.supabase = supabase;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Authentication middleware error');
      throw new UnauthorizedException("Erreur d'authentification");
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
}
