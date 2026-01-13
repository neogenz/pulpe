# Task: Auth API OAuth Enhancements

## Problem

The auth layer lacks a centralized way to access OAuth user metadata (given_name, full_name) from the Supabase session. Additionally, the Google OAuth sign-in doesn't specify an explicit `redirectTo`, which can cause unpredictable post-auth routing.

## Proposed Solution

Enhance `auth-api.ts` with:
1. A helper method `getOAuthUserMetadata()` that extracts name information from `session.user.user_metadata`
2. Add explicit `redirectTo` option in `signInWithGoogle()` pointing to `/app` to let guards handle routing

## Dependencies

- None (foundation task)

## Context

- Key file: `frontend/projects/webapp/src/app/core/auth/auth-api.ts`
- Follow existing computed signal style (e.g., `readonly session = this.#sessionSignal.asReadonly()`)
- `signInWithGoogle()` is at lines 253-278
- Import `ROUTES` from `@core/routing/routes-constants` for redirectTo URL

## Success Criteria

- `getOAuthUserMetadata()` returns `{ givenName?: string; fullName?: string }` or null
- `signInWithGoogle()` includes `redirectTo: \`${window.location.origin}/${ROUTES.APP}\``
- Unit tests pass for new functionality
- Existing auth tests still pass
