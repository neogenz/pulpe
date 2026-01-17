# Task: Create AuthSessionService for Supabase Session Management

## Problem

Session lifecycle management (Supabase client initialization, session loading, auth state change listeners) is currently embedded in the large `AuthApi` service. This logic should be isolated in a dedicated service responsible for all Supabase-related session operations.

## Proposed Solution

Create a new `AuthSessionService` that extracts Supabase session management from `auth-api.ts`. This service will:
- Own the Supabase client instance lifecycle
- Initialize authentication state (including E2E bypass logic)
- Set up auth state change listeners
- Provide methods to get current session and refresh session
- Coordinate with AuthStateService to update state signals

This service acts as the bridge between Supabase and our application state.

## Dependencies

- **Task 1**: AuthStateService must exist (this service calls setSession/setLoading methods)

## Context

**Files to extract from:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:54-56` - Supabase client field
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:108-190` - initializeAuthState() method
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:122-135, 200-213` - E2E helper methods
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:421-437` - getCurrentSession()
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:443-466` - refreshSession()

**Similar pattern to follow:**
- `UserSettingsApi` (146 lines) - Service composition via inject(), manages external API lifecycle

**Key design principles:**
- Inject AuthStateService, ApplicationConfiguration, Logger
- Own Supabase client lifecycle (creation, access, cleanup)
- Replace direct signal mutations with AuthStateService calls
- Preserve E2E bypass logic for testing

## Success Criteria

- [ ] `auth-session.service.ts` created with @Injectable({ providedIn: 'root' })
- [ ] Injects AuthStateService, ApplicationConfiguration, Logger
- [ ] Private Supabase client field with public getClient() method
- [ ] initializeAuthState() method handles normal and E2E bypass flows
- [ ] E2E helper methods (#isE2EBypass, #getE2EMockState, #setE2EMockState)
- [ ] getCurrentSession() and refreshSession() methods
- [ ] Auth state change listener updates AuthStateService
- [ ] `auth-session.service.spec.ts` created with comprehensive tests
- [ ] Tests mock createClient, AuthStateService methods
- [ ] Tests verify normal initialization flow (client creation, session load, listener setup)
- [ ] Tests verify E2E bypass flow (skips Supabase, uses mock state)
- [ ] Tests verify session refresh propagates to AuthStateService
- [ ] All tests pass with `pnpm test -- auth-session.service.spec.ts`
