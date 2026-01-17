# Task: Create AuthCredentialsService for Email/Password Authentication

## Problem

Email and password authentication methods (sign in and sign up) are currently mixed with other authentication concerns in `AuthApi`. These credential-based auth flows should be isolated in a dedicated service.

## Proposed Solution

Create a new `AuthCredentialsService` that extracts email/password authentication from `auth-api.ts`. This service will:
- Handle signInWithEmail() flow with error localization
- Handle signUpWithEmail() flow including email confirmation cases
- Manage loading state transitions via AuthStateService
- Support E2E bypass mode for testing
- Coordinate with AuthSessionService for Supabase client access

This service encapsulates all credential-based authentication logic.

## Dependencies

- **Task 1**: AuthStateService must exist (for setSession/setLoading calls)
- **Task 2**: AuthSessionService must exist (for getClient() calls)

## Context

**Files to extract from:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:256-285` - signInWithEmail()
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:291-316` - signUpWithEmail()

**Services to inject:**
- AuthSessionService (for Supabase client access)
- AuthStateService (for loading state management)
- AuthErrorLocalizer (for user-friendly error messages)
- Logger (for error logging with context)

**Key design principles:**
- Try-catch-finally pattern with loading state management
- E2E bypass checks at method entry
- Error localization for all Supabase errors
- Preserve exact return type { success: boolean; error?: string } for backward compatibility

## Success Criteria

- [ ] `auth-credentials.service.ts` created with @Injectable({ providedIn: 'root' })
- [ ] Injects AuthSessionService, AuthStateService, AuthErrorLocalizer, Logger
- [ ] signInWithEmail() method with E2E bypass, error handling, state management
- [ ] signUpWithEmail() method with email confirmation handling
- [ ] Loading state properly managed (true before operation, false in finally)
- [ ] All errors localized and logged with context
- [ ] `auth-credentials.service.spec.ts` created with comprehensive tests
- [ ] Tests mock all injected services
- [ ] Tests verify success path (loading transitions, session update, return value)
- [ ] Tests verify error path (localization, logging, return value)
- [ ] Tests verify E2E bypass for both methods
- [ ] Tests verify loading state always reset in finally block
- [ ] All tests pass with `pnpm test -- auth-credentials.service.spec.ts`
