import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

/**
 * Custom throttler guard that tracks rate limits by user ID for authenticated requests
 * and falls back to IP for public/unauthenticated requests.
 *
 * Execution order: AuthGuard → UserThrottlerGuard
 * This ensures req.user is available when throttling decisions are made.
 *
 * Rate Limiting Strategy:
 * - Authenticated users: Tracked by user.id (1000 req/min default)
 * - Public endpoints: Tracked by IP address (e.g., demo: 30 req/hour)
 *
 * Why user-based tracking:
 * - Prevents false positives from shared IPs (WiFi, VPN, proxies)
 * - Same user gets same limit across different devices/locations
 * - Protects against abuse from compromised accounts
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  /**
   * Generates the tracking key for rate limiting.
   *
   * Logic:
   * 1. If req.user exists (authenticated) → track by user.id
   * 2. Otherwise → track by IP address (default behavior)
   *
   * Key format:
   * - Authenticated: `user:{userId}:{suffix}`
   * - Unauthenticated: `{ip}:{suffix}` (default from parent)
   *
   * This allows:
   * - Authenticated users to have consistent rate limits across IPs
   * - Public endpoints to remain protected by IP-based throttling
   * - Demo endpoint to maintain its IP-based 30 req/hour limit
   */
  protected override generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    // Use user ID for authenticated requests
    if (user?.id) {
      return `user:${user.id}:${suffix}`;
    }

    // Fall back to IP-based tracking for public/unauthenticated requests
    // This calls the parent class method which handles IP extraction properly
    return super.generateKey(context, suffix, name);
  }
}
