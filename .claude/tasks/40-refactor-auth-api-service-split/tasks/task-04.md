# Task: Create AuthOAuthService for Google OAuth Authentication

## Problem

OAuth authentication flow (specifically Google sign-in) is currently embedded in the large `AuthApi` service along with other authentication methods. OAuth has unique characteristics (redirect-based flow, metadata parsing) that warrant separation.

## Proposed Solution

Create a new `AuthOAuthService` that extracts OAuth authentication from `auth-api.ts`. This service will:
- Parse OAuth user metadata (avatar URL, full name) from session
- Handle signInWithGoogle() flow with redirect URL construction
- Support E2E bypass mode for testing
- Coordinate with AuthSessionService for Supabase client access

This service encapsulates OAuth-specific authentication logic, particularly Google sign-in.

## Dependencies

- **Task 1**: AuthStateService must exist (for state access)
- **Task 2**: AuthSessionService must exist (for getClient() calls)

## Context

**Files to extract from:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:85-106` - getOAuthUserMetadata()
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:318-346` - signInWithGoogle()

**Services to inject:**
- AuthSessionService (for Supabase client access)
- AuthStateService (for reading current session)
- ApplicationConfiguration (for baseUrl in redirect)
- Logger (for error logging)

**Key design principles:**
- OAuth redirects user away, session update happens on return
- Metadata parsing is a pure helper function
- E2E bypass at method entry
- Error handling with localization

## Success Criteria

- [ ] `auth-oauth.service.ts` created with @Injectable({ providedIn: 'root' })
- [ ] Injects AuthSessionService, AuthStateService, ApplicationConfiguration, Logger
- [ ] getOAuthUserMetadata() method returns { avatarUrl, fullName } or null
- [ ] signInWithGoogle() constructs redirect URL with baseUrl
- [ ] signInWithGoogle() calls Supabase OAuth with correct parameters
- [ ] E2E bypass logic implemented
- [ ] Error handling with localization
- [ ] `auth-oauth.service.spec.ts` created with comprehensive tests
- [ ] Tests mock AuthSessionService.getClient() and ApplicationConfiguration.baseUrl
- [ ] Tests verify getOAuthUserMetadata() parsing (valid and null cases)
- [ ] Tests verify signInWithGoogle() redirect URL construction
- [ ] Tests verify E2E bypass
- [ ] Tests verify error handling
- [ ] All tests pass with `pnpm test -- auth-oauth.service.spec.ts`
