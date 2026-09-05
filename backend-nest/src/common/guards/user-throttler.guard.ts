import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Request } from 'express';
import { proxyClientIp } from '@common/utils/proxy-client-ip';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { isDemoPath, PUBLIC_THROTTLER_NAME } from '@config/throttler.config';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { resolvePayDayOfMonth } from '@common/utils/pay-day';

interface RequestWithThrottlerCache extends Request {
  __throttlerUserCache?: AuthenticatedUser | null;
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
  private async resolveUser(
    request: Request,
  ): Promise<AuthenticatedUser | undefined> {
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

      if (user.app_metadata?.scheduledDeletionAt) {
        return undefined;
      }

      const clientKeyHex = request.headers?.['x-client-key'] as
        | string
        | undefined;
      const clientKey = clientKeyHex
        ? Buffer.from(clientKeyHex, 'hex')
        : Buffer.alloc(0);

      return {
        id: user.id,
        email: user.email ?? '',
        firstName: user.user_metadata?.firstName,
        lastName: user.user_metadata?.lastName,
        payDayOfMonth: resolvePayDayOfMonth(user.user_metadata),
        accessToken: token,
        clientKey,
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
   * Leaves the `public` bucket only for requests whose token actually resolves
   * to a user.
   *
   * The bucket used to be skipped from the module config on the mere presence
   * of an `Authorization: Bearer ` header, which no one validated — any forged
   * value lifted the caller from 20 req/min to the 200 req/min authenticated
   * bucket. Resolution happens here rather than in a `skipIf`, which the
   * library calls synchronously and which would therefore depend on the
   * `default` throttler having populated the request cache first.
   */
  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name === PUBLIC_THROTTLER_NAME) {
      const req = requestProps.context
        .switchToHttp()
        .getRequest<RequestWithThrottlerCache>();
      if (typeof req.auth?.extra?.userId === 'string') return true;
      const user = await this.#resolveCachedUser(req);
      if (user?.id) return true;
    }

    return super.handleRequest(requestProps);
  }

  /** Resolves the request's user once, then serves it from the request cache. */
  async #resolveCachedUser(
    req: RequestWithThrottlerCache,
  ): Promise<AuthenticatedUser | null> {
    if (req.__throttlerUserCache === undefined) {
      req.__throttlerUserCache = (await this.resolveUser(req)) ?? null;
    }
    return req.__throttlerUserCache;
  }

  /**
   * Overrides the tracker generation to use user ID for authenticated requests.
   *
   * This is the proper NestJS throttler extension point for async operations.
   * getTracker() is called before rate limit checks and supports async resolution.
   *
   * Performance Note:
   * getTracker() runs once per throttler bucket that actually reaches
   * `super.handleRequest` — a bucket dropped by `skipIf` never gets there.
   * An authenticated request therefore only reaches it through `default`,
   * since handleRequest above answers `public` without delegating; an
   * unauthenticated one reaches it through both, and demo routes add their
   * own buckets on top. Request-scoped caching keeps user resolution to a
   * single Supabase call whatever that count turns out to be.
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
    // Demo routes stay IP-keyed, always. POST /demo/session returns a working
    // Bearer token, so keying its bucket by that token lets a caller mint a
    // fresh empty bucket per demo user created — unbounded user creation from
    // one IP, defeating the `demo` / `demoUnverified` caps that the fail-open
    // Turnstile path names as its compensating control.
    if (isDemoPath(req.url)) {
      return this.#getClientIpTracker(req);
    }

    // Set only by the MCP SDK's verified-bearer middleware, never from a header/body.
    if (typeof req.auth?.extra?.userId === 'string') {
      return `user:${req.auth.extra.userId}`;
    }

    const user = await this.#resolveCachedUser(req);

    // Use user ID for authenticated requests
    if (user?.id) {
      return `user:${user.id}`;
    }

    // Fall back to IP-based tracking for public/unauthenticated requests
    return this.#getClientIpTracker(req);
  }

  /**
   * Resolves the throttle key for unauthenticated requests to the real client IP.
   *
   * Behind Railway's edge proxy `req.ip` (and `super.getTracker`) would resolve
   * to the proxy address, collapsing every public request into one near-global
   * bucket. Railway always sets `X-Real-IP` to the real connecting client and
   * overwrites any client-supplied value (substituting `CF-Connecting-IP` when
   * the service sits behind Cloudflare), so it is the spoof-proof per-client key.
   *
   * We deliberately do NOT read `X-Forwarded-For`: its entries can be
   * client-supplied, which would let an attacker rotate the throttle key and
   * defeat per-IP limits. When `X-Real-IP` is absent (local/dev, no proxy) we
   * fall back to the base IP behaviour (`req.ip`).
   *
   * The value is validated as a real IPv4/IPv6 address before use. Deployments
   * where the header is not proxy-controlled would otherwise hand the caller a
   * free throttle key: any arbitrary string becomes a brand-new empty bucket,
   * so per-IP caps could be rotated away one request at a time.
   */
  async #getClientIpTracker(req: RequestWithThrottlerCache): Promise<string> {
    const clientIp = proxyClientIp(req);
    if (clientIp) {
      return clientIp;
    }
    return super.getTracker(req);
  }
}
