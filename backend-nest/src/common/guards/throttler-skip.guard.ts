import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

/**
 * Custom throttler guard that skips rate limiting for authenticated requests
 *
 * Security Strategy:
 * - Public endpoints (@Public decorator): ALWAYS rate limited, even with Bearer token
 * - Protected endpoints (default): Skip rate limiting if Bearer token present
 *
 * Why this is secure:
 * 1. Public endpoints (like /demo/session) are always rate limited
 * 2. Protected endpoints skip throttling because AuthGuard validates the JWT
 * 3. Cannot bypass rate limiting on public endpoints with fake Bearer tokens
 *
 * Protection layers:
 * - Layer 1: Rate limiting on public endpoints (prevents spam)
 * - Layer 2: JWT validation on protected endpoints (ensures user identity)
 * - Layer 3: Supabase RLS policies (ensures data isolation)
 */
@Injectable()
export class SkipAuthenticatedThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly reflector: Reflector,
    ...args: ConstructorParameters<typeof ThrottlerGuard>
  ) {
    super(...args);
  }

  /**
   * Skip rate limiting for authenticated requests on PROTECTED endpoints only
   *
   * Security check:
   * 1. If endpoint is @Public → NEVER skip (always rate limit)
   * 2. If endpoint is protected AND has Bearer token → Skip (AuthGuard will validate)
   * 3. Otherwise → Apply rate limiting
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    // Check if the endpoint is marked as @Public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // SECURITY: Public endpoints are ALWAYS rate limited, even with Bearer token
    // This prevents bypassing rate limiting on /demo/session with fake tokens
    if (isPublic) {
      return false; // Do NOT skip throttling for public endpoints
    }

    // For protected endpoints: skip throttling if Bearer token is present
    // The AuthGuard will validate the token and reject if invalid
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return true; // Skip throttling for authenticated requests
    }

    // No auth header on protected endpoint → Apply rate limiting
    return false;
  }
}
