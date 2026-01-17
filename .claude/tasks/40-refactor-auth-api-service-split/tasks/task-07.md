# Task: Refactor AuthApi to Facade Pattern with Service Delegation

## Problem

The original 475-line `AuthApi` service needs to be refactored into a lightweight facade that delegates to the 6 specialized services created in previous tasks. This refactoring must maintain complete backward compatibility for the 24 files that currently consume `AuthApi`.

## Proposed Solution

Refactor the existing `auth-api.ts` file into a facade pattern that:
- Keeps the same class name (`AuthApi`) and file name
- Injects all 6 specialized auth services
- Delegates all public methods and signals to appropriate services
- Adds deprecation notice for future migration
- Reduces from 475 lines to approximately 60 lines

**CRITICAL**: This is a refactor of an existing file, NOT creating a new file. Maintain exact API surface for consumers.

## Dependencies

- **Tasks 1-6**: All specialized services must be complete
  - AuthStateService
  - AuthSessionService
  - AuthCredentialsService
  - AuthOAuthService
  - AuthDemoService
  - AuthCleanupService

## Context

**File to refactor:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts` (EXISTING file, 475 lines → ~60 lines)

**Affected consumers (24 files):**
- Must maintain exact API - no breaking changes
- Guards, interceptors, pages, layouts all depend on AuthApi

**Refactoring pattern:**
- Remove all implementation code
- Inject 6 services via inject()
- Expose signals from AuthStateService (readonly delegation)
- Delegate methods to appropriate services (pure delegation, no logic)

**Key elements to preserve:**
- Class name: `AuthApi`
- File name: `auth-api.ts`
- All public signals: session, isLoading, user, isAuthenticated, authState
- All public methods: initializeAuthState, getCurrentSession, refreshSession, signInWithEmail, signUpWithEmail, getOAuthUserMetadata, signInWithGoogle, setSession, signOut
- AuthState interface export

## Success Criteria

- [ ] `auth-api.ts` refactored (NOT created new)
- [ ] JSDoc deprecation notice added to class
- [ ] All 6 services injected
- [ ] All public signals delegate to AuthStateService
- [ ] All public methods delegate to appropriate services
- [ ] No business logic in facade (pure delegation only)
- [ ] AuthState interface still exported
- [ ] File reduced to ~60 lines
- [ ] `auth-api.spec.ts` refactored to test delegation
- [ ] Tests verify signals come from AuthStateService
- [ ] Tests verify methods delegate to correct services
- [ ] Mock all 6 injected services in tests
- [ ] Remove implementation-specific tests (now in service-specific specs)
- [ ] All existing consumers still work (no API changes)
- [ ] All tests pass with `pnpm test -- auth-api.spec.ts`
- [ ] Full test suite passes: `pnpm test`
