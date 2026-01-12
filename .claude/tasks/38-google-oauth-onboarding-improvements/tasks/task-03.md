# Task: OAuth Error Localization

## Problem

When users cancel Google OAuth login (e.g., close the Google popup), the error message shown may not be user-friendly or properly localized in French.

## Proposed Solution

Add French localization for OAuth cancellation errors in `auth-error-localizer.ts`:
- `access_denied` → "Connexion annulée"
- `user_cancelled_login` → "Connexion annulée"

## Dependencies

- None (independent task)

## Context

- Key file: `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.ts`
- Follow existing error message mapping pattern in `AUTH_ERROR_MESSAGES`
- OAuth cancellation can only be tested via unit tests (E2E impossible due to external Google redirect)

## Success Criteria

- OAuth cancellation errors display "Connexion annulée" to users
- Unit tests verify error localization for both error codes
- Existing error localizations remain unchanged
