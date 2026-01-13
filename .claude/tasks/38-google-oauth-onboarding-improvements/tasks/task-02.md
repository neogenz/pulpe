# Task: Profile Prefill from OAuth Metadata

## Problem

When users sign up via Google OAuth, their name is available in the session metadata but isn't being used to pre-fill the profile form. Additionally, returning users with existing budgets should be redirected to the dashboard instead of seeing the complete-profile page.

## Proposed Solution

1. In `complete-profile-store.ts`: Add `prefillFromOAuthMetadata()` method that reads OAuth metadata and calls `updateFirstName()` if name data is available
2. In `complete-profile-page.ts`: On init, call prefill (sync) and then check for existing budgets (async), redirecting if found

## Dependencies

- Task 1: Auth API OAuth Enhancements (needs `getOAuthUserMetadata()`)

## Context

- Store: `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts`
- Page: `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts`
- Store already has `checkExistingBudgets()` that returns boolean
- Use `givenName` first, fallback to first word of `fullName`
- Redirect to `['/', ROUTES.APP, ROUTES.CURRENT_MONTH]` if budgets exist

## Success Criteria

- OAuth users see their first name pre-filled in the profile form
- Users with existing budgets are redirected to dashboard (no infinite loops)
- Loading spinner shows while checking budgets
- Unit tests cover all prefill scenarios (givenName, fullName, no metadata)
