# Security Strategy - Rate Limiting

## Overview

Pulpe implements a **multi-layered rate limiting strategy** to protect against abuse while ensuring legitimate users can use the application without friction.

## Rate Limiting Configuration

### 1. Public Endpoints (IP-based)

**Target**: Unauthenticated requests (demo mode, public APIs)

- **Demo endpoint** (`/api/v1/demo/session`):
  - **Limit**: 10 requests per hour per IP
  - **Why**: Prevents spam account creation and abuse of demo mode
  - **Protected by**: Cloudflare Turnstile + IP-based rate limiting

### 2. Authenticated Endpoints (User-based)

**Target**: All authenticated API requests

- **All authenticated endpoints**:
  - **Limit**: 1000 requests per minute per user
  - **Tracking**: By user ID (extracted from JWT)
  - **Why**: Prevents individual user abuse while allowing normal workflows

## Security Guarantees

### ✅ What This Protects Against

1. **DoS attacks from malicious users**: A single user cannot overwhelm the API
2. **Demo mode abuse**: Public endpoints have strict IP-based limits
3. **Runaway costs**: Prevents excessive Supabase queries from a single user
4. **Frontend bugs**: Infinite loops are automatically stopped at 1000 req/min
5. **Multi-account attacks**: Each user is tracked individually (not by IP)

### ⚠️ Limitations

1. **Distributed attacks**: Multiple users attacking simultaneously are not blocked by this layer
2. **Supabase RLS is primary defense**: Rate limiting is a secondary protection
3. **No protection for very slow attacks**: Under 1000 req/min is allowed

## Why 1000 Requests/Minute?

This limit is based on realistic usage patterns:

- **Normal user**: 10-50 requests/minute during active usage
- **Onboarding workflow**: ~100-150 requests (creating templates, budgets, lines)
- **Yearly planning**: ~200-300 requests (12 budgets × 20-25 operations each)
- **Legitimate heavy usage**: ~500 requests/minute (edge case)
- **Malicious abuse**: 1000+ requests/minute (blocked)

### Example Workflows

| Workflow                     | Requests | Duration | Rate     | Blocked? |
| ---------------------------- | -------- | -------- | -------- | -------- |
| Browse monthly budgets       | 10       | 1 min    | 10/min   | ❌ No    |
| Create yearly budget         | 250      | 2 min    | 125/min  | ❌ No    |
| Bulk import transactions     | 500      | 5 min    | 100/min  | ❌ No    |
| Frontend infinite loop       | 5000     | 1 min    | 5000/min | ✅ Yes   |
| Malicious scraping           | 10000    | 10 min   | 1000/min | ✅ Yes   |

## Implementation Details

### How It Works

1. **Request arrives** at the API
2. **ThrottlerGuard executes** before AuthGuard
3. **JWT is decoded** (not verified) to extract user ID
4. **Tracking key is determined**:
   - Authenticated: `user:<user_id>`
   - Public: `<ip_address>`
5. **Rate limit is checked** against in-memory store
6. **Request is allowed or rejected** (HTTP 429)

### Code Location

- **Guard**: `backend-nest/src/common/guards/throttler-skip.guard.ts`
- **Configuration**: `backend-nest/src/app.module.ts` (ThrottlerModule.forRootAsync)
- **Tests**: `backend-nest/src/common/guards/throttler-skip.guard.spec.ts`

### Storage

Rate limiting state is stored **in-memory** (default NestJS throttler storage):

- **Pros**: Fast, no database overhead
- **Cons**: Resets on server restart, not shared across instances
- **Future**: Consider Redis for multi-instance deployments

## Monitoring & Alerts

### How to Monitor

1. **HTTP 429 responses**: Check logs for `ThrottlerException: Too Many Requests`
2. **User ID in logs**: Identify which users are hitting limits
3. **Endpoint analysis**: Which endpoints trigger rate limits most often

### Expected Behavior

- **Legitimate users**: Should NEVER hit 429 errors during normal usage
- **Demo mode**: May hit 429 if trying to create more than 10 demo sessions/hour from same IP
- **Malicious users**: Should be blocked and logged

### When to Adjust Limits

**Increase limits if**:

- Legitimate users frequently hit 429 errors
- New workflows require more requests (e.g., bulk operations)
- User complaints about "Too Many Requests"

**Decrease limits if**:

- Supabase costs are unexpectedly high
- Evidence of abuse or scraping
- Need stricter protection

## Incident Response

### If a User is Blocked (HTTP 429)

1. **Check logs**: Verify the user's request pattern
2. **Analyze legitimacy**: Is this normal usage or abuse?
3. **Options**:
   - Temporarily increase limit (requires code change + redeploy)
   - Ask user to slow down
   - Investigate for frontend bugs

### If Under Attack

1. **Monitor Supabase usage**: Check for unusual query patterns
2. **Identify attackers**: Check logs for user IDs hitting limits
3. **Block at application level**: Add user ID to blocklist (future feature)
4. **Scale rate limiting**: Consider adding Redis for distributed rate limiting

## Future Improvements

1. **Per-endpoint limits**: Different limits for expensive operations (e.g., bulk create)
2. **Redis storage**: For multi-instance deployments
3. **Dynamic limits**: Adjust based on user tier (free vs paid)
4. **User blocklist**: Ban malicious users at application level
5. **Metrics & dashboards**: Real-time monitoring of rate limit hits

## References

- [NestJS Throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [OWASP Rate Limiting Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Rate_Limiting_Cheat_Sheet.html)
- Supabase Row Level Security (primary defense layer)

---

_Last updated: 2025-10-24_
