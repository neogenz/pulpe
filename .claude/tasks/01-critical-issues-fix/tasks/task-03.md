# Task: Integrate Google OAuth Button and Password Constant in Auth Pages

## Problem

After creating the shared OAuth button component and auth constants, we need to update the 3 pages that currently have duplicated OAuth logic:
- `signup.ts` - Uses magic number + duplicated OAuth
- `login.ts` - Uses magic number + duplicated OAuth
- `welcome-page.ts` - Uses duplicated OAuth only

## Proposed Solution

Update each page to:
1. Import and use `PASSWORD_MIN_LENGTH` from `@core/auth` (signup, login only)
2. Import and use `<pulpe-google-oauth-button>` from `@app/pattern/google-oauth`
3. Remove the local `signInWithGoogle()` method
4. Wire up component outputs to existing signals

## Dependencies

- **Task 1**: Auth constants must exist
- **Task 2**: Google OAuth button component must exist

## Context

- signup.ts: Replace magic number at line 320, replace OAuth button at lines 270-282, remove method at lines 391-411
- login.ts: Replace magic number at line 204, replace OAuth button at lines 161-173, remove method at lines 270-290
- welcome-page.ts: Replace OAuth button at lines 85-110 (use buttonType="filled"), remove method at lines 248-266
- Each page has different signal names for loading state (isSubmitting vs isGoogleLoading)

## Success Criteria

- All 3 pages use `<pulpe-google-oauth-button>` component
- signup.ts and login.ts use `PASSWORD_MIN_LENGTH` constant
- No `signInWithGoogle()` methods remain in the 3 pages
- OAuth functionality works identically (manual testing)
- `pnpm quality` passes
