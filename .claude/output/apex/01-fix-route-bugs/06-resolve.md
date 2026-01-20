# Step 06: Resolve

**Task:** Fix route bugs found in code review
**Started:** 2026-01-19T14:40:00Z

---

## Resolution Strategy

**Mode:** Auto-fix Real findings (auto_mode = true)

**Scope:**
- F1 (BLOCKING - Real): Fix fail-open guard → **FIXED**
- F2 (CRITICAL - Real): Cache miss after auth → **DEFERRED** (requires architecture discussion)
- F3-F7: Pre-existing issues → **SKIPPED** (out of scope)

---

## Resolution Log

### F1: Fix Fail-Open Guard ✓

**Files modified:**
1. `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts`
2. `frontend/projects/webapp/src/app/core/auth/has-budget.guard.spec.ts`

**Changes:**

**1. has-budget.guard.ts**
- Updated comment: "Fail-safe" → "Fail-closed: Redirects to complete-profile on errors (secure default)"
- Changed `logger.warn()` → `logger.error()` for proper severity
- Changed `return true;` → `return redirectToCompleteProfile();` to deny access on errors

**Before:**
```typescript
} catch (error) {
  logger.warn(
    'hasBudgetGuard: API error during cache miss, allowing navigation (fail-safe)',
    error,
  );
  return true;
}
```

**After:**
```typescript
} catch (error) {
  logger.error(
    'hasBudgetGuard: API error during cache miss, redirecting to complete-profile (fail-closed)',
    error,
  );
  return redirectToCompleteProfile();
}
```

**2. has-budget.guard.spec.ts**
- Updated mock: `logger.warn` → `logger.error`
- Updated test: "should allow navigation on API error (fail-safe)" → "should redirect to complete-profile on API error (fail-closed)"
- Changed expectation: `expect(result).toBe(true)` → `expect(result).toEqual({})` (redirect UrlTree)
- Added assertion for `createUrlTree` call with `ROUTES.COMPLETE_PROFILE`

---

## Deferred Findings

### F2: Cache Miss After Auth

**Reason for deferral:** This optimization requires architectural changes across multiple services (login, signup, OAuth). Should be addressed in a dedicated performance ticket.

**Recommended approach:**
1. Create `BudgetCachePreloader` service
2. Call after successful authentication, before navigation
3. Consider using route resolver instead of guard for initial load

---

## Validation Results

**Tests:**
```
Test Files: 69 passed (69)
Tests: 963 passed (963)
```

**Quality:**
```
pnpm quality → ✓ PASSED
- Type-check: ✓
- Lint: ✓ (3 pre-existing warnings in backend)
- Format: ✓
```

---

## Summary

| Finding | Status | Action |
|---------|--------|--------|
| F1 (BLOCKING) | ✓ Fixed | Changed to fail-closed |
| F2 (CRITICAL) | Deferred | Performance optimization ticket |
| F3 (CRITICAL) | Skipped | Verify E2E bypass in production |
| F4 (MEDIUM) | Skipped | Low probability edge case |
| F5-F7 (LOW) | Skipped | Pre-existing tech debt |

**Findings fixed:** 1
**Findings deferred:** 1
**Findings skipped:** 5

---

## Step Complete

**Status:** ✓ Complete
**Findings fixed:** 1
**Findings skipped:** 6 (1 deferred for separate ticket)
**Validation:** ✓ Passed (963/963 tests, quality checks green)
**Timestamp:** 2026-01-19T14:45:00Z
