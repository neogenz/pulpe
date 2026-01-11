# Task: Add Unit Tests for Welcome Page

## Problem

The new welcome page component needs unit tests to ensure reliability and catch regressions. Tests should cover the main user interactions and error scenarios.

## Proposed Solution

Create a comprehensive test suite for the welcome page covering:
- Component initialization
- Google OAuth button behavior
- Email login navigation
- Demo mode with Turnstile flow
- Error handling and display
- Loading states

## Dependencies

- **Task 1:** Welcome page component must exist

## Context

### File to create:
`feature/welcome/welcome-page.spec.ts`

### Testing patterns to follow:
- `feature/auth/login/login.spec.ts` (if exists)
- `feature/complete-profile/complete-profile-store.spec.ts` (AAA pattern)
- `.claude/rules/testing/vitest.md` (testing guidelines)

### Mocks needed:
- `AuthApi` - mock `signInWithGoogle()` method
- `DemoInitializerService` - mock `startDemoSession()` and `isInitializing`
- `Router` - mock `navigate()` method
- `ApplicationConfiguration` - mock `turnstile()` and `isLocal()`

### Test scenarios:
1. Component creates successfully
2. Google OAuth button calls `authApi.signInWithGoogle()`
3. Email button navigates to `/login`
4. "Se connecter" link navigates to `/login`
5. Demo button triggers Turnstile or bypasses in local
6. OAuth error displays error message
7. Loading state shows during OAuth
8. Turnstile error displays error message

## Success Criteria

- [ ] Test file created with proper imports (vitest, TestBed)
- [ ] All major user flows covered
- [ ] Mocks properly configured
- [ ] Tests follow AAA pattern
- [ ] All tests pass with `pnpm test`
