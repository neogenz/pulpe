# Task: Welcome Page & Signup UX Improvements

## Problem

1. The welcome page lacks CGU/Privacy Policy mention for Google OAuth users (legal requirement)
2. The login page links to `/welcome` instead of directly to `/signup` when creating an account
3. No analytics tracking for signup funnel (Google vs email methods)

## Proposed Solution

1. Add CGU text under the Google OAuth button on welcome page (informational, not blocking)
2. Fix login page link to go directly to `/signup`
3. Add PostHog analytics:
   - `signup_started` event with method ('google' or 'email') on welcome page
   - `signup_completed` event with method 'email' in signup.ts after successful registration

## Dependencies

- None (can run in parallel with Tasks 1-2)

## Context

- Welcome page: `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`
- Login page: `frontend/projects/webapp/src/app/feature/auth/login/login.ts` (line 154)
- Signup page: `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts`
- CGU text styling: `text-body-small text-on-surface-variant text-center mt-2 max-w-sm`
- Links to legal pages use ROUTES.LEGAL, ROUTES.LEGAL_TERMS, ROUTES.LEGAL_PRIVACY

## Success Criteria

- CGU text visible below Google OAuth button on welcome page
- Login "Créer un compte" link navigates to /signup
- Analytics events fire correctly for both signup methods
- Unit tests verify CGU text presence and analytics calls
