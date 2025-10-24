import { Injectable, type ExecutionContext, Logger } from '@nestjs/common';
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
 * - Layer 1: Rate limiting on public endpoints (prevents spam/DDoS)
 * - Layer 2: JWT validation on protected endpoints (ensures user identity)
 * - Layer 3: Supabase RLS policies (ensures data isolation)
 *
 * Attack Prevention Examples:
 * ❌ Blocked: POST /api/v1/demo/session with fake Bearer token (rate limited)
 * ❌ Blocked: POST /api/v1/demo/session without auth (rate limited at 30/hour)
 * ✅ Allowed: GET /api/v1/budgets with valid Bearer token (no rate limit)
 * ❌ Rejected: GET /api/v1/budgets with invalid Bearer token (401 from AuthGuard)
 */
@Injectable()
export class SkipAuthenticatedThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(SkipAuthenticatedThrottlerGuard.name);

  constructor(
    protected override readonly reflector: Reflector,
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
   *
   * Error Handling:
   * If any error occurs during the check, we fail SECURELY by applying rate limiting.
   * This prevents bypassing rate limits due to unexpected errors.
   */
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    try {
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
      // Explicit type check ensures we don't call .startsWith on undefined/null
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return true; // Skip throttling for authenticated requests
      }

      // No auth header on protected endpoint → Apply rate limiting
      return false;
    } catch (error) {
      // SECURITY: If anything goes wrong, fail securely by applying rate limiting
      this.logger.error('Error in shouldSkip check, applying rate limiting as fallback', error);
      return false; // Apply rate limiting on error
    }
  }
}
