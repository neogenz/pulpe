# Task: Migrate UserController to BusinessException Pattern

## Problem

`UserController` uses generic NestJS exceptions (`InternalServerErrorException`) instead of the standardized `BusinessException` pattern. This inconsistency makes error handling less predictable and logging less informative across the application.

## Proposed Solution

Migrate all 8 methods in `UserController` to use `BusinessException` with appropriate `ERROR_DEFINITIONS`:

- `updateProfile` and `performProfileUpdate` → USER_PROFILE_UPDATE_FAILED
- `completeOnboarding` and `updateOnboardingStatus` → USER_ONBOARDING_UPDATE_FAILED
- `getCurrentUserData` → USER_FETCH_FAILED
- `getOnboardingStatus` → USER_ONBOARDING_FETCH_FAILED
- `getSettings` → USER_SETTINGS_FETCH_FAILED
- `updateSettings` → USER_SETTINGS_UPDATE_FAILED

Replace catch blocks with `handleServiceError()` utility where appropriate. Include proper cause chains for Supabase errors.

## Dependencies

- Task #1: Add Missing ERROR_DEFINITIONS

## Context

- Key file: `backend-nest/src/modules/user/user.controller.ts`
- Follow pattern from conforming services: `budget.service.ts`, `transaction.service.ts`
- Use `handleServiceError()` from `@common/utils/error-handler`
- Remove unused `InternalServerErrorException` import after migration

## Success Criteria

- No generic NestJS exceptions remain in UserController
- All errors use BusinessException with appropriate ERROR_DEFINITIONS
- Proper cause chains preserve original error context
- `pnpm test` passes
- `pnpm quality` passes
