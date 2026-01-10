# Task: Update Login Page Reference and Final Cleanup

## Problem

The login page still has a "Créer un compte" link pointing to `/onboarding/welcome` which no longer exists. Additionally, there may be orphaned storage keys and unused exports related to onboarding.

## Proposed Solution

Update the login page link and perform final cleanup:
- Change login.ts routerLink from `/onboarding/welcome` to `/welcome`
- Remove `ONBOARDING` constant from routes if no longer needed
- Clean up any onboarding-related storage keys
- Verify UI exports are still valid

## Dependencies

- **Task 4:** Onboarding must be deleted first to identify any remaining references

## Context

### Files to modify:
- `feature/auth/login/login.ts` - Line 182-183, "Créer un compte" link
- `core/routing/routes-constants.ts` - Remove `ONBOARDING` if unused
- `core/storage/storage-keys.ts` - Remove `ONBOARDING_DATA` if exists

### Login page link:
Current: `routerLink="/onboarding/welcome"`
New: `routerLink="/welcome"`

## Success Criteria

- [ ] "Créer un compte" link in login page navigates to `/welcome`
- [ ] No references to `ROUTES.ONBOARDING` remain in codebase
- [ ] Storage keys cleaned up (if any existed)
- [ ] `pnpm quality` passes
- [ ] Manual test: login → "Nouveau sur Pulpe ?" → navigates to welcome
