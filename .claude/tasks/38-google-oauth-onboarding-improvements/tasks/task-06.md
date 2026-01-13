# Task: E2E Tests for Complete Profile Flow

## Problem

The complete-profile flow lacks E2E test coverage. We need to verify the full user journey works correctly, including OAuth metadata prefill and budget creation.

## Proposed Solution

Create comprehensive E2E tests covering:
1. Returning user redirect (existing budget → dashboard)
2. First-time user complete flow (steps 1 and 2)
3. OAuth user firstName prefill (mocked OAuth session)
4. Minimal budget creation (skip step 2)
5. Full budget creation (fill step 2 charges)

## Dependencies

- Task 1: Auth API OAuth Enhancements
- Task 2: Profile Prefill from OAuth Metadata
- Task 3: OAuth Error Localization
- Task 4: Welcome Page & Signup UX Improvements
- Task 5: Complete Profile Analytics

## Context

- New file: `frontend/e2e/tests/features/complete-profile.spec.ts`
- Follow existing patterns from `authentication.spec.ts`
- Use authenticated fixture with mock session containing OAuth metadata
- Real OAuth redirect (Google) cannot be tested in E2E - use mocked scenarios only

## Success Criteria

- All E2E tests pass in CI
- Tests cover happy path and edge cases
- OAuth metadata prefill verified via mocked session
- Redirect behavior verified for returning users
- Budget creation verified for first-time users
