import type { ExecutionContext } from '@nestjs/common';

/**
 * Per-IP hourly cap for *unverified* demo-session creation (empty Turnstile
 * token). Kept deliberately tight versus the 30/h verified-traffic limit.
 *
 * Why empty tokens are accepted at all: the web client intentionally sends an
 * empty token on Safari/iOS and on Turnstile load timeout, because the widget
 * is known to loop, freeze the main thread, or fail behind iCloud Private Relay
 * / Lockdown mode — still reproducible as of 2026. Failing those clients closed
 * would lock real Safari users out of the demo. An empty token carries no proof
 * though, so the same path is scriptable by bots; this throttler caps the abuse
 * scale without breaking Safari. Value stays generous (10, not the bare minimum)
 * so multiple genuine Safari users sharing a Private Relay / NAT egress IP are
 * not falsely blocked.
 */
export const DEMO_UNVERIFIED_HOURLY_LIMIT = 10;

// Trailing slash is load-bearing: without it the prefix would also match a
// sibling like `/api/v1/demography`. Every real demo route is nested under
// `/api/v1/demo/` (session, cleanup), so the slash narrows to exactly them.
const DEMO_PATH_PREFIX = '/api/v1/demo/';
const DEMO_SESSION_PATH = `${DEMO_PATH_PREFIX}session`;

interface ThrottlerRequest {
  url?: string;
  body?: { turnstileToken?: unknown };
}

/**
 * True for any demo route. Demo-session creation hands the caller a usable
 * Bearer token, so these paths MUST stay IP-keyed in the throttler: a
 * user-keyed bucket is self-mintable (create a demo user, replay the request
 * with its own token, land in a brand-new empty bucket, repeat). That would
 * defeat the `demo` / `demoUnverified` per-IP caps the fail-open Turnstile
 * path depends on. Consumed by UserThrottlerGuard.getTracker.
 *
 * Lowercased for the same reason as isUnverifiedDemoSessionRequest: Express
 * routes case-insensitively.
 */
export const isDemoPath = (url?: string): boolean =>
  url?.toLowerCase().startsWith(DEMO_PATH_PREFIX) ?? false;

/**
 * True when the request is a demo-session creation carrying an empty (or
 * missing) Turnstile token — the unverified, bot-scriptable path.
 */
export const isUnverifiedDemoSessionRequest = (
  context: ExecutionContext,
): boolean => {
  const request = context.switchToHttp().getRequest<ThrottlerRequest>();
  // Lowercase before matching: Express routes case-insensitively, so
  // `/api/v1/DEMO/session` still reaches the handler — a case-sensitive
  // startsWith would let an attacker dodge this cap by varying path casing.
  const isDemoSession =
    request?.url?.toLowerCase().startsWith(DEMO_SESSION_PATH) ?? false;
  const token = request?.body?.turnstileToken;
  const hasEmptyToken = typeof token !== 'string' || token.length === 0;
  return isDemoSession && hasEmptyToken;
};
