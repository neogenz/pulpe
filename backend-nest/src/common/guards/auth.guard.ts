import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(AuthGuard.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = this.extractTokenFromHeader(request);

    if (!accessToken) {
      throw new UnauthorizedException("Token d'accès requis");
    }

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
