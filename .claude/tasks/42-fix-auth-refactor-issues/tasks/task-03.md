# Task: Fix Error Logging in Auth Credentials Service

## Problem

The `auth-credentials.service.ts` has silent catch blocks in both `signInWithEmail()` (line 45) and `signUpWithEmail()` (line 80) that swallow errors without logging. This loses critical diagnostic information about **unexpected** system failures.

**Critical Distinction**:
- **Expected user errors** (wrong password, duplicate email): Already handled via error responses, should NOT be logged
- **Unexpected system errors** (network failures, API crashes, exceptions): Need logging for debugging infrastructure issues

Currently, unexpected errors like network failures or Supabase client crashes are silently caught and return generic error messages, making it impossible to diagnose production issues.

## Proposed Solution

Add error logging to catch blocks for **unexpected errors only**:
- Change catch blocks to capture the error object
- Log using `Logger.error()` with descriptive context
- Keep existing return statements unchanged
- Do NOT log expected user errors (those are handled before the try-catch via error responses)

This follows the established logging pattern while respecting the distinction between user errors (expected) and system errors (unexpected).

## Dependencies

- None (can start immediately)
- Independent file, no conflicts with other tasks

## Context

- **File to modify**: `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts`
- **Test file**: `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.spec.ts`
- **Logger pattern reference**: Exploration document lines 72-92
- **Key insight**: Only log when exceptions are thrown (unexpected), not when error responses are returned (expected user errors)

## Success Criteria

- [ ] Unexpected errors during sign-in are logged with context
- [ ] Unexpected errors during sign-up are logged with context
- [ ] Expected user errors (wrong password, duplicate email) are NOT logged
- [ ] Unit tests verify logging happens for unexpected errors
- [ ] Unit tests verify logging does NOT happen for expected auth errors
- [ ] `pnpm test` passes for auth-credentials.service.spec.ts
