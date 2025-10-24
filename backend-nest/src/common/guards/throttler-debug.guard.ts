import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

/**
 * DEBUG VERSION of ThrottlerGuard with detailed logging
 *
 * This guard logs every throttling decision to help debug rate limiting issues.
 *
 * Use this temporarily to understand why legitimate users are getting 429 errors.
 */
@Injectable()
export class ThrottlerDebugGuard extends ThrottlerGuard {
  /**
   * Skip rate limiting for all authenticated requests
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    const hasAuth = authHeader && authHeader.startsWith('Bearer ');

    console.log('[THROTTLE DEBUG]', {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      ip: request.ip,
      hasAuthHeader: !!hasAuth,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
      willSkip: !!hasAuth,
    });

    if (hasAuth) {
      return true; // Skip throttling for authenticated requests
    }

    return false; // Apply throttling for public endpoints
  }

  /**
   * Override to log when throttling is actually applied
   */
  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      const result = await super.handleRequest(context, limit, ttl);

      console.log('[THROTTLE DEBUG] Request allowed', {
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        ip: request.ip,
        limit,
        ttl,
      });

      return result;
    } catch (error) {
      console.error('[THROTTLE DEBUG] Request BLOCKED (429)', {
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        ip: request.ip,
        limit,
        ttl,
        error: error.message,
      });

      throw error;
    }
  }
}
