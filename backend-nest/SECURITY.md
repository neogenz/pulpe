# Security Strategy - Rate Limiting

## Overview

Pulpe implements a **pragmatic rate limiting strategy** that balances security with user experience. Rate limiting is **only applied to public endpoints** to prevent abuse of demo mode and anonymous access.

## Rate Limiting Configuration

### 1. Public Endpoints (IP-based, Strict)

**Target**: Unauthenticated requests (demo mode, public APIs)

- **Demo endpoint** (`/api/v1/demo/session`):
  - **Limit**: 10 requests per hour per IP
  - **Why**: Prevents spam account creation and abuse of demo mode
  - **Protected by**: Cloudflare Turnstile + IP-based rate limiting

### 2. Authenticated Endpoints (No Rate Limiting)

**Target**: All authenticated API requests

- **All authenticated endpoints**: **NO rate limiting**
- **Why**:
  - JWT authentication + Supabase RLS provide sufficient protection
  - Rate limiting causes false positives and blocks legitimate users
  - Standard industry practice (GitHub, Stripe, Vercel all do this)
  - Users have highly variable usage patterns (onboarding, bulk operations, etc.)

## Security Layers

### For Authenticated Requests (No Rate Limiting)

Authentication and authorization are handled through multiple layers:

1. **JWT Validation**: Ensures user identity via Supabase Auth
2. **Row Level Security (RLS)**: Enforces data isolation at database level
3. **Database Constraints**: Ensures data integrity and prevents malicious operations

These layers provide **stronger security than rate limiting** because they:
- Prevent unauthorized access to data
- Isolate users' data from each other
- Validate every single database operation

### For Public Requests (Strict Rate Limiting)

Public endpoints have aggressive rate limiting:

1. **IP-based tracking**: Each IP address has its own quota
2. **Low limits**: 10 requests per hour prevents spam
3. **Cloudflare Turnstile**: Anti-bot verification before rate limit check

## Why No Rate Limiting for Authenticated Users?

### Industry Standard Practice

Major SaaS APIs follow this pattern:

| Service       | Authenticated Limit     | Public Limit        |
| ------------- | ----------------------- | ------------------- |
| **GitHub**    | 5,000 req/hour          | 60 req/hour         |
| **Stripe**    | No limit (fair use)     | N/A (auth required) |
| **Vercel**    | 20 req/10s (very high)  | N/A (auth required) |
| **Pulpe**     | **No limit**            | **10 req/hour**     |

### Real-World User Patterns

Legitimate Pulpe users have highly variable usage:

| Workflow                   | Requests | Duration | Rate      | Would Block? |
| -------------------------- | -------- | -------- | --------- | ------------ |
| Browse budgets             | 10-20    | 1 min    | 10-20/min | ❌ No        |
| Complete onboarding        | 100-150  | 5 min    | 20-30/min | ❌ No        |
| Create yearly budget       | 200-300  | 3 min    | 60-100/min| ❌ No        |
| Bulk template updates      | 500+     | 2 min    | 250/min   | ❌ No        |
| Normal active usage        | Variable | Variable | Spiky     | ❌ No        |

**With rate limiting at 1000 req/min**: Users can still hit false positives during bulk operations.

**Without rate limiting**: No false positives, smooth user experience.

### Why JWT + RLS > Rate Limiting

**Rate limiting** protects against:
- ✅ Anonymous abuse (solved by applying it only to public endpoints)
- ❌ Does NOT protect against data breaches (needs authentication)
- ❌ Does NOT protect against privilege escalation (needs RLS)
- ❌ Does NOT protect against malicious data manipulation (needs RLS)

**JWT + RLS** protects against:
- ✅ Unauthorized access to data
- ✅ Data isolation between users
- ✅ Privilege escalation
- ✅ Malicious data manipulation
- ✅ All database-level threats

**Conclusion**: JWT + RLS provides stronger security than rate limiting for authenticated endpoints.

## Attack Scenarios & Mitigations

### Scenario 1: Malicious User with Valid Account

**Attack**: User creates account and spams API

**Mitigations**:
1. **Supabase RLS**: User can only access their own data (no impact on other users)
2. **Supabase quotas**: Supabase has built-in query quotas per user
3. **User monitoring**: Can detect and ban abusive accounts
4. **Cost controls**: Supabase alerts on unusual usage

**Why rate limiting doesn't help**: A malicious user would create multiple accounts anyway to bypass per-user limits.

### Scenario 2: Frontend Bug (Infinite Loop)

**Attack**: Bug causes infinite API requests

**Mitigations**:
1. **Browser limits**: Browser itself limits concurrent requests
2. **JWT expiration**: Tokens expire, limiting duration of bug impact
3. **Frontend monitoring**: Sentry/error tracking detects infinite loops
4. **Code review**: Prevent bugs through testing and review

**Why rate limiting doesn't help**: Rate limiting would block the user, but they'd still see errors and the bug would still exist. Better to detect and fix the bug.

### Scenario 3: Stolen JWT Token

**Attack**: Attacker steals JWT and spams API

**Mitigations**:
1. **Token expiration**: JWTs expire quickly (1 hour)
2. **RLS policies**: Attacker can only access stolen user's data
3. **Token refresh flow**: Can revoke refresh tokens
4. **User activity monitoring**: Unusual activity can trigger alerts

**Why rate limiting doesn't help**: Attacker would respect rate limits or use multiple tokens. RLS prevents data access regardless of request volume.

### Scenario 4: DDoS Attack

**Attack**: Massive volume of requests to overwhelm server

**Mitigations**:
1. **Infrastructure level**: Railway/Cloudflare handle DDoS
2. **Rate limiting on public endpoints**: Demo endpoint protected
3. **Authenticated requests**: Attacker needs valid JWTs (expensive to obtain at scale)

**Why application-level rate limiting doesn't help**: DDoS is an infrastructure problem, not an application problem. Cloudflare and Railway have DDoS protection.

## Implementation Details

### Code Location

- **Guard**: `backend-nest/src/common/guards/throttler-skip.guard.ts`
- **Configuration**: `backend-nest/src/app.module.ts` (ThrottlerModule.forRootAsync)
- **Tests**: `backend-nest/src/common/guards/throttler-skip.guard.spec.ts`

### How It Works

1. **Request arrives** at the API
2. **ThrottlerGuard checks** for Authorization header
3. **If `Authorization: Bearer <token>` present**:
   - Skip rate limiting entirely
   - Let AuthGuard validate the token
4. **If no auth header** (public endpoint):
   - Apply IP-based rate limiting
   - Demo endpoint: 10 req/hour

### Storage

Rate limiting state is stored **in-memory** (default NestJS throttler storage):

- **Pros**: Fast, no database overhead
- **Cons**: Resets on server restart, not shared across instances
- **Impact**: Only affects public endpoints (demo mode)

For a production multi-instance deployment, consider Redis for rate limiting storage.

## Monitoring & Alerts

### What to Monitor

1. **HTTP 429 on public endpoints**: Normal behavior for spam/abuse
2. **HTTP 429 on authenticated endpoints**: **Should NEVER happen** (indicates bug)
3. **Unusual user activity**: High request volume from single user (potential abuse)
4. **Supabase usage**: Database query volume and costs

### Expected Behavior

- **Legitimate users**: Should NEVER see 429 errors
- **Demo mode users**: May hit 429 if exceeding 10 sessions/hour from same IP
- **Malicious users**: Public endpoints blocked, authenticated endpoints limited by JWT + RLS

## Cost Controls

### Supabase Built-in Protection

Supabase provides automatic cost protection:

1. **Database query limits**: Prevents runaway queries
2. **Connection pooling**: Limits concurrent connections
3. **Usage alerts**: Email alerts on high usage
4. **Project quotas**: Hard limits on free/paid tiers

### Pulpe-Specific Controls

1. **RLS policies**: Each query is scoped to authenticated user
2. **Efficient queries**: Indexed queries, no N+1 problems
3. **Pagination**: Large result sets are paginated
4. **No public write endpoints**: All write operations require authentication

## Decision Log

### Why We Removed Per-User Rate Limiting

**Date**: 2025-10-24

**Problem**:
- Users hitting 429 errors after only ~27 requests in 11 minutes
- Per-user rate limiting implementation was complex and buggy
- False positives blocking legitimate workflows

**Decision**:
- Remove all rate limiting from authenticated endpoints
- Keep rate limiting only on public endpoints (demo mode)

**Rationale**:
1. **Industry standard**: GitHub, Stripe, Vercel all do this
2. **User experience**: No false positives, smooth workflows
3. **Security**: JWT + RLS provides stronger protection than rate limiting
4. **Simplicity**: Less code, less bugs, easier to maintain

**Risks Accepted**:
- Malicious user could create account and spam API
- Mitigated by: RLS isolation, Supabase quotas, user monitoring

**Alternative Considered**:
- Higher per-user limits (e.g., 10,000 req/min)
- Rejected because: Still causes false positives, adds complexity

## Future Improvements

If abuse becomes a problem, consider:

1. **Redis-based rate limiting**: For multi-instance deployments
2. **Per-endpoint limits**: Different limits for expensive operations
3. **User tier-based limits**: Free vs paid users
4. **Automatic user blocking**: Ban users with suspicious patterns
5. **Real-time monitoring**: Dashboard for rate limit hits

However, **we should only add these if there's evidence of actual abuse**. Premature optimization causes more problems than it solves.

## References

- [NestJS Throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [OWASP Rate Limiting Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Rate_Limiting_Cheat_Sheet.html)
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api)
- [Stripe API Rate Limits](https://stripe.com/docs/rate-limits)
- Supabase Row Level Security (primary defense layer)

---

_Last updated: 2025-10-24 - Removed per-user rate limiting after false positives_
