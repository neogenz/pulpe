# Task: Create AuthCleanupService for Logout Cleanup Coordination

## Problem

Logout requires coordinating cleanup across multiple services (auth state, demo mode, cache, analytics, storage). This orchestration logic is currently embedded in `AuthApi` and should be extracted to a dedicated cleanup coordination service.

## Proposed Solution

Create a new `AuthCleanupService` that extracts logout and cleanup coordination from `auth-api.ts`. This service will:
- Handle signOut() flow with Supabase sign-out
- Coordinate cleanup across all affected services
- Support E2E bypass mode for testing
- Manage error handling during sign-out

**CRITICAL CHANGE**: Remove budget pre-loading functionality. The guards already handle cache miss gracefully, so pre-loading is unnecessary complexity.

## Dependencies

- **Task 1**: AuthStateService must exist (for state clearing)
- **Task 2**: AuthSessionService must exist (for Supabase client access)
- **Tasks 3, 4, 5**: Should be complete for full auth ecosystem (though not direct dependencies)

## Context

**Files to extract from:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:394-419` - signOut()
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:220-236` - #handleSignOut() cleanup logic

**⚠️ CRITICAL - DO NOT EXTRACT:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:237-254` - #preloadHasBudgetFlag() (REMOVE ENTIRELY)
- **DO NOT inject BudgetApi** - per exploration recommendation, guards handle cache miss

**Services to inject:**
- AuthStateService, AuthSessionService (auth coordination)
- DemoModeService (clear demo mode)
- HasBudgetCache (clear budget cache)
- PostHogService (reset analytics)
- StorageService (clear user-specific storage)
- Logger (error logging)

**Key design principles:**
- Orchestration service coordinates cleanup across multiple services
- E2E bypass at sign-out entry
- Try-catch for Supabase sign-out with error logging
- Single source of truth for logout cleanup

## Success Criteria

- [ ] `auth-cleanup.service.ts` created with @Injectable({ providedIn: 'root' })
- [ ] Injects AuthStateService, AuthSessionService, DemoModeService, HasBudgetCache, PostHogService, StorageService, Logger
- [ ] **DOES NOT inject BudgetApi** (critical - removed per plan)
- [ ] signOut() method with E2E bypass and Supabase sign-out
- [ ] #handleSignOut() private method coordinates all cleanup
- [ ] Cleanup steps: clear auth state, demo mode, cache, analytics, storage
- [ ] **NO budget pre-loading logic** (removed entirely)
- [ ] Error handling logs failures but continues cleanup
- [ ] `auth-cleanup.service.spec.ts` created with comprehensive tests
- [ ] Tests mock all injected services
- [ ] Tests verify signOut() calls Supabase client.auth.signOut()
- [ ] Tests verify all cleanup steps called in correct order
- [ ] Tests verify E2E bypass
- [ ] Tests verify error logging when sign-out fails
- [ ] All tests pass with `pnpm test -- auth-cleanup.service.spec.ts`
