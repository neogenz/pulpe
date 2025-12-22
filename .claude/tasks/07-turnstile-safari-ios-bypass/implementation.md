# Implementation: Turnstile Safari iOS Bypass

## Completed

- Modified `turnstile.service.ts` to accept empty Turnstile tokens in production/preview
- Changed `return false` to `return true` for empty tokens (line 56)
- Changed log level from `warn` to `log` (info level) since it's now expected behavior
- Added comments explaining the rate limiting protection
- Updated test in `turnstile.service.spec.ts` to expect `true` for empty tokens
- Renamed test from "should return false if token is empty" to "should return true if token is empty (rate-limited)"

## Files Changed

| File | Change |
|------|--------|
| `backend-nest/src/common/services/turnstile.service.ts:52-57` | Accept empty tokens, return true |
| `backend-nest/src/common/services/turnstile.service.spec.ts:112-116` | Update test expectation |

## Deviations from Plan

None - implementation followed the plan exactly.

## Test Results

- Typecheck: ✓
- Lint: ✓ (0 errors, 5 warnings - all pre-existing)
- Tests: ✓ (16/16 pass including updated empty token test)

## Security Note

Protection against abuse is maintained by:
- Rate limiting: 30 requests/hour/IP (already configured in `demo.controller.ts`)
- IP-based throttling via `UserThrottlerGuard`

## Follow-up Tasks

- Deploy to Railway preview and test on Safari iOS
- Verify demo session creation works without 403 error
