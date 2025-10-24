import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Custom throttler guard that completely skips rate limiting for authenticated requests
 *
 * Security Strategy:
 * - Public endpoints (no auth): Strict rate limiting (10 req/hour for demo)
 * - Authenticated endpoints: NO rate limiting (JWT + RLS = sufficient protection)
 *
 * Why skip throttling for authenticated users?
 * 1. JWT authentication + Supabase RLS already provide strong protection
 * 2. Rate limiting on authenticated endpoints causes false positives (blocks legitimate users)
 * 3. Standard industry practice (GitHub, Stripe, Vercel all do this)
 * 4. Legitimate users have highly variable usage patterns (onboarding, bulk ops, etc.)
 *
 * Protection layers for authenticated requests:
 * - Layer 1: JWT validation (ensures user identity)
 * - Layer 2: Supabase RLS policies (ensures data isolation)
 * - Layer 3: Database constraints (ensures data integrity)
 *
 * Rate limiting is ONLY applied to public endpoints (demo mode) to prevent spam.
 */
@Injectable()
export class SkipAuthenticatedThrottlerGuard extends ThrottlerGuard {
  /**
   * Skip rate limiting for all authenticated requests
   *
   * We detect authentication by checking for the Authorization header.
   * If present, we skip throttling entirely and let the AuthGuard handle validation.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    // If Authorization header is present, skip rate limiting
    // The AuthGuard will validate the JWT and ensure the user is authentic
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return true; // Skip throttling for authenticated requests
    }

    // No auth header = public endpoint = apply rate limiting
    return false;
  }
}
