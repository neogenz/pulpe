import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { Request } from 'express';
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
      throw new UnauthorizedException("Token d'accès requis");
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

      request.user = cachedUser;
      request.supabase = supabase;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Erreur d'authentification");
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
