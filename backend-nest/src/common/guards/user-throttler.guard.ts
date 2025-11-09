import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

/**
 * Request object extended with throttler cache
 * Used to cache user resolution within a single request lifecycle
 */
interface RequestWithThrottlerCache extends Record<string, any> {
  __throttlerUserCache?: AuthenticatedUser | null;
  headers?: { authorization?: string };
}

/**
 * Custom throttler guard with user-based rate limiting.
 *
 * Tracks rate limits by user ID for authenticated requests and falls back to IP
 * address for public/unauthenticated endpoints.
 *
 * @remarks
 * **Architecture Decision:**
 * Registered as `APP_GUARD` (global) to execute before controller-scoped guards
 * like `AuthGuard`. This enables self-resolution of authentication for accurate
 * user-based throttling.
 *
 * **Execution Flow:**
 * 1. `UserThrottlerGuard` (global) → resolves user via token
 * 2. Rate limiting decision (user-based or IP-based)
 * 3. `AuthGuard` (controller-scoped) → reuses cached user
 *
 * **Rate Limiting Strategy:**
 * - Authenticated users: Tracked by `user.id` (1000 req/min default)
 * - Public endpoints: Tracked by IP address (e.g., demo: 30 req/hour)
 *
 * **Performance Optimization:**
 * Request-scoped caching eliminates redundant Supabase calls:
 * - Without cache: 3 calls (2 throttler contexts + 1 AuthGuard)
 * - With cache: 1 call (shared across guards)
 * - Result: 66% reduction in auth API overhead (~10-20ms improvement)
 *
 * **Design Trade-offs:**
 * - Graceful degradation: Auth failures fall back to IP-based throttling
 * - Cache lifetime: Request-scoped (auto-cleaned after response)
 *
 * @see https://docs.nestjs.com/faq/request-lifecycle - NestJS guard execution order
 * @see https://docs.nestjs.com/security/rate-limiting - Official throttling guide
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @InjectPinoLogger(UserThrottlerGuard.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {
    // Pass ThrottlerGuard dependencies (required even though we override getTracker)
    // These are used by the parent class for rate limit checks and reflection
    super(options, storageService, reflector);
  }

  /**
   * Resolves user from request token without throwing errors.
   *
   * This method:
   * 1. Extracts Bearer token from Authorization header
   * 2. Validates token via Supabase auth.getUser()
   * 3. Returns user object if valid, undefined if not
   *
   * Graceful degradation: Any auth failure results in undefined (IP-based throttling)
   * This ensures public endpoints continue to work while authenticated endpoints
   * benefit from user-based throttling.
   */
  private async resolveUser(request: {
    headers?: { authorization?: string };
  }): Promise<AuthenticatedUser | undefined> {
    try {
      const authHeader = request.headers?.authorization;
      if (!authHeader) return undefined;

      const [type, token] = authHeader.split(' ') ?? [];
      if (type !== 'Bearer' || !token) return undefined;

      const supabase = this.supabaseService.createAuthenticatedClient(token);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) return undefined;

      return {
        id: user.id,
        email: user.email ?? '',
        firstName: user.user_metadata?.firstName,
        lastName: user.user_metadata?.lastName,
      };
    } catch (error) {
      // Log errors at debug level (not warn) to avoid noise from invalid tokens
      this.logger.debug(
        { err: error },
        'Failed to resolve user for throttling (falling back to IP-based)',
      );
      return undefined;
    }
  }

  /**
   * Overrides the tracker generation to use user ID for authenticated requests.
   *
   * This is the proper NestJS throttler extension point for async operations.
   * getTracker() is called before rate limit checks and supports async resolution.
   *
   * Performance Note:
   * NestJS ThrottlerGuard calls getTracker() once per configured throttler context.
   * With 2 contexts (default + demo), this method is called twice per request.
   * Request-scoped caching ensures user resolution happens only once.
   *
   * Logic:
   * 1. Check request cache for previously resolved user
   * 2. If cache miss: resolve user from token and cache result
   * 3. If user exists (authenticated) → return `user:{userId}` as tracker
   * 4. Otherwise → call parent's getTracker() for IP-based tracking
   *
   * Tracker format:
   * - Authenticated: `user:{userId}`
   * - Unauthenticated: IP address from parent (e.g., `192.168.1.1`)
   *
   * This allows:
   * - Authenticated users to have consistent rate limits across IPs
   * - Public endpoints to remain protected by IP-based throttling
   * - Demo endpoint to maintain its IP-based 30 req/hour limit
   * - AuthGuard can reuse cached user (eliminates 3rd Supabase call)
   */
  protected override async getTracker(
    req: RequestWithThrottlerCache,
  ): Promise<string> {
    // Check cache first (undefined means not yet resolved, null means resolution failed)
    if (req.__throttlerUserCache !== undefined) {
      const cachedUser = req.__throttlerUserCache;
      if (cachedUser?.id) {
        return `user:${cachedUser.id}`;
      }
      // Cached null = auth failed, use IP-based tracking
      return super.getTracker(req);
    }

    // Cache miss: resolve user and cache result
    const user = await this.resolveUser(req);
    req.__throttlerUserCache = user || null; // Cache even if undefined (null = failed auth)

    // Use user ID for authenticated requests
    if (user?.id) {
      return `user:${user.id}`;
    }

    // Fall back to IP-based tracking for public/unauthenticated requests
    // This calls the parent class method which handles IP extraction properly
    return super.getTracker(req);
  }
}
