# Task: Create AuthDemoService for Demo Mode Session Injection

## Problem

Demo mode requires the ability to inject mock sessions without going through actual Supabase authentication. This functionality is currently mixed into `AuthApi` and should be isolated to support demo mode integration.

## Proposed Solution

Create a new `AuthDemoService` that extracts demo mode session injection from `auth-api.ts`. This service will:
- Provide a setSession() method to inject mock sessions
- Update AuthStateService with the provided session
- Log session injection for debugging
- Have no Supabase interaction (bypasses real auth entirely)

This is a simple service specifically for `DemoInitializerService` to inject mock sessions.

## Dependencies

- **Task 1**: AuthStateService must exist (for setSession calls)
- **Task 2**: AuthSessionService must exist (though not directly used, part of auth ecosystem)

## Context

**Files to extract from:**
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts:356-392` - setSession()

**Services to inject:**
- AuthStateService (for state mutation)
- Logger (for logging session injection)

**Key design principles:**
- Simple state setter, no business logic
- Used exclusively by demo mode initialization
- No Supabase interaction
- Clear logging for debugging

**Consumer:**
- `DemoInitializerService` uses this to inject mock sessions when demo mode is activated

## Success Criteria

- [ ] `auth-demo.service.ts` created with @Injectable({ providedIn: 'root' })
- [ ] Injects AuthStateService and Logger
- [ ] setSession(session: Session | null) method
- [ ] Method updates AuthStateService.setSession()
- [ ] Method logs session injection
- [ ] `auth-demo.service.spec.ts` created with tests
- [ ] Tests mock AuthStateService
- [ ] Tests verify setSession() with valid session updates state
- [ ] Tests verify setSession() with null clears state
- [ ] Tests verify logging occurs
- [ ] All tests pass with `pnpm test -- auth-demo.service.spec.ts`
