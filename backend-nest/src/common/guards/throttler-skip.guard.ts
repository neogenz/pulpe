import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Custom throttler guard that applies user-based rate limiting
 *
 * Security Strategy:
 * - Public endpoints (no auth): Rate limited by IP address (10 req/hour for demo)
 * - Authenticated endpoints: Rate limited by User ID (1000 req/minute)
 *
 * Why user-based throttling for authenticated requests?
 * 1. Prevents a single malicious user from DoS attacks
 * 2. Protects against accidental infinite loops (frontend bugs)
 * 3. Controls Supabase costs (prevents runaway queries)
 * 4. Still allows normal user workflows (onboarding, bulk operations)
 *
 * The limit is high enough for legitimate use but prevents abuse:
 * - Normal user: ~10-50 requests/minute during active usage
 * - Bulk operations: ~100-200 requests/minute (yearly planning)
 * - Malicious user: blocked at 1000 requests/minute
 */
@Injectable()
export class SkipAuthenticatedThrottlerGuard extends ThrottlerGuard {
  /**
   * Customize the tracking key based on authentication status
   *
   * - For authenticated requests: Use user ID as tracking key (extracted from JWT)
   * - For public requests: Use IP address as tracking key (default behavior)
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader = req.headers?.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // Extract JWT token
        const token = authHeader.substring(7);

        // Decode JWT payload (without verification - just for user ID extraction)
        // The AuthGuard will verify the token later
        const payload = this.decodeJwtPayload(token);

        if (payload && payload.sub) {
          // Use user ID from JWT 'sub' claim as tracking key
          return `user:${payload.sub}`;
        }
      } catch (error) {
        // Invalid token - fall through to IP-based tracking
        // The request will be rejected later by AuthGuard
      }
    }

    // For public endpoints or invalid tokens, use IP-based tracking
    return req.ip || 'unknown';
  }

  /**
   * Decode JWT payload without verification
   * We only need the user ID for rate limiting tracking
   * Full verification is done by AuthGuard
   */
  private decodeJwtPayload(token: string): any {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode base64url payload
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Determine which throttler configuration to use
   *
   * This allows us to apply different rate limits based on the endpoint
   */
  protected async getThrottlerConfig(
    context: ExecutionContext,
  ): Promise<{ name: string } | undefined> {
    const request = context.switchToHttp().getRequest();
    const path = request.url || '';

    // Demo endpoint uses restrictive rate limit (10 req/hour)
    if (path.includes('/demo/session')) {
      return { name: 'demo' };
    }

    // All other endpoints use default rate limit (1000 req/minute)
    return undefined;
  }
}
