# Task: Create AuthStateService for Signal-Based State Management

## Problem

The current `AuthApi` service (475 lines) contains signal-based state management mixed with authentication logic, session management, and cleanup coordination. This violates the Single Responsibility Principle and makes the code harder to test and maintain.

We need a dedicated service to manage authentication state signals, providing a single source of truth for auth state across the application.

## Proposed Solution

Create a new `AuthStateService` that extracts and encapsulates all signal-based state management from `auth-api.ts`. This service will:
- Own private signals for session and loading state
- Expose readonly computed signals for public consumption
- Provide setter methods for state mutations
- Have zero dependencies (pure state service)

This becomes the foundation that other auth services will depend on for state access and mutations.

## Dependencies

- None (can start immediately)

## Context

**Files to extract from:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:57-59` - Private signals (#sessionSignal, #isLoadingSignal)
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:67-81` - Public readonly signals
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:215-218` - State mutation method (#updateAuthState)
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:61-66` - AuthState interface

**Similar pattern to follow:**
- `DemoModeService` (76 lines) - Private signals with readonly exposure, clean separation

**Key design principles:**
- Pure state service with no side effects
- No injected dependencies
- Private signals with readonly computed exposure
- Simple setter methods for mutations

## Success Criteria

- [ ] `auth-state.service.ts` created with @Injectable({ providedIn: 'root' })
- [ ] Private signals for session and isLoading
- [ ] Public readonly computed signals (session, user, isAuthenticated, authState)
- [ ] Public setSession() and setLoading() methods
- [ ] AuthState interface exported
- [ ] `auth-state.service.spec.ts` created with comprehensive tests
- [ ] Tests verify signal initialization (session=null, isLoading=true)
- [ ] Tests verify setSession() updates both session and computed user
- [ ] Tests verify computed authState aggregates all signals
- [ ] All tests pass with `pnpm test -- auth-state.service.spec.ts`
