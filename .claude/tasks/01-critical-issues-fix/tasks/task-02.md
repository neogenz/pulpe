# Task: Create Google OAuth Button Pattern Component

## Problem

The `signInWithGoogle()` method is duplicated in 3 files with nearly identical logic:
- `welcome-page.ts:248-266`
- `signup.ts:391-411`
- `login.ts:270-290`

Each implementation:
1. Sets a loading signal
2. Calls `authApi.signInWithGoogle()`
3. Handles error/success with identical error messages
4. Resets loading state

This violates DRY and makes maintenance difficult.

## Proposed Solution

Create a reusable pattern component `<pulpe-google-oauth-button>` in `pattern/google-oauth/` that encapsulates the OAuth flow. The component will:
- Handle loading state internally
- Emit events for parent components to react to (loading, error)
- Support customization via inputs (label, button style, testId)

## Dependencies

- None (can start immediately, but Task 1 should be done first for cleaner codebase)

## Context

- Architecture reference: `pattern/README.md` - Pattern components can inject from `core/`
- Component pattern: `edit-transaction-form.ts` - Signal-based with OnPush
- Test pattern: `edit-transaction-form.spec.ts` - Vitest + TestBed setup
- Service to inject: `core/auth/auth-api.ts` - AuthApi service
- Logging: `core/logging/logger.ts` - Logger service

## Success Criteria

- New component `pattern/google-oauth/google-oauth-button.ts` exists
- Component has inputs: buttonLabel, buttonType, testId
- Component has outputs: loading, error
- Test file `google-oauth-button.spec.ts` covers:
  - Success path (no error emitted)
  - Failure path (error emitted)
  - Exception path (logs + generic error)
  - Loading state changes
- Barrel export in `pattern/google-oauth/index.ts`
- All tests pass
