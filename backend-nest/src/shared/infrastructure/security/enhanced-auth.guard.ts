import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseService } from '../../../modules/supabase/supabase.service';
import { PinoLogger } from 'nestjs-pino';

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'isPublic';

@Injectable()
export class EnhancedAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(EnhancedAuthGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn({
        operation: 'auth_guard_no_token',
        path: request.path,
        method: request.method,
        ip: request.ip,
      });
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const startTime = Date.now();
      const {
        data: { user },
        error,
      } = await this.supabaseService.getClient().auth.getUser(token);

      if (error || !user) {
        this.logger.warn({
          operation: 'auth_guard_invalid_token',
          path: request.path,
          method: request.method,
          ip: request.ip,
          error: error?.message,
          duration: Date.now() - startTime,
        });
        throw new UnauthorizedException('Invalid authentication token');
      }

      // Enhance request with user context
      (request as any).user = {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
        role: user.role,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
      };

      // Check for required roles if specified
      const requiredRoles = this.reflector.getAllAndOverride<string[]>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = requiredRoles.some(
          (role) =>
            user.user_metadata?.roles?.includes(role) || user.role === role,
        );

        if (!hasRole) {
          this.logger.warn({
            operation: 'auth_guard_insufficient_role',
            userId: user.id,
            requiredRoles,
            userRole: user.role,
            path: request.path,
            method: request.method,
            duration: Date.now() - startTime,
          });
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      this.logger.info({
        operation: 'auth_guard_success',
        userId: user.id,
        path: request.path,
        method: request.method,
        duration: Date.now() - startTime,
      });

      return true;
    } catch {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error({
        operation: 'auth_guard_error',
        path: request.path,
        method: request.method,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
