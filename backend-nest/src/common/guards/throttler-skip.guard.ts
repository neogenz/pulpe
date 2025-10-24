import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Custom throttler guard that skips rate limiting for authenticated requests
 *
 * Rate limiting should only apply to public endpoints (like /demo/session)
 * Authenticated users are already limited by their JWT auth and don't need throttling
 *
 * This prevents legitimate users from hitting HTTP 429 errors during normal usage
 */
@Injectable()
export class SkipAuthenticatedThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip throttling if request has a valid Authorization header
    // This means the user is authenticated and will be validated by AuthGuard
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // User is authenticated - skip rate limiting
      return true;
    }

    // No auth header - apply rate limiting (public endpoint)
    return false;
  }
}
