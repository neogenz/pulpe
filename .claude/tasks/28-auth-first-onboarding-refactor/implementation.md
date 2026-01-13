# Implementation: Auth-First Onboarding Refactor

## Completed

### Phase 1: Create Welcome Feature
- Created `feature/welcome/welcome.routes.ts` - Route configuration for the new welcome page
- Created `feature/welcome/welcome-page.ts` - Standalone component with:
  - Google OAuth button (primary CTA)
  - Email signup button (navigates to /login)
  - Demo mode button with Turnstile protection
  - Lottie animation (reused from old onboarding)
  - Error handling and loading states
- Created `feature/welcome/index.ts` - Barrel export for lazy loading

### Phase 2: Update Routing Constants
- Updated `core/routing/routes-constants.ts`:
  - Added `WELCOME: 'welcome'` route constant
  - Removed all onboarding step constants (ONBOARDING, ONBOARDING_WELCOME, ONBOARDING_PERSONAL_INFO, etc.)
  - Removed onboarding-related page titles

### Phase 3: Update Routing and Guards
- Updated `app.routes.ts`:
  - Changed root redirect from `/app` to `/welcome`
  - Added new `/welcome` route with publicGuard
  - Removed `/onboarding` route entirely
- Updated `core/auth/auth-guard.ts`:
  - Changed redirect for unauthenticated users from `/onboarding` to `/welcome`
- Updated `core/auth/public-guard.ts`:
  - Changed fallback redirect from `/onboarding` to `/welcome`

### Phase 4: Delete Old Onboarding Feature
- Deleted entire `feature/onboarding/` directory (~2000 lines removed):
  - All 9 step components
  - OnboardingStore and related specs
  - OnboardingStepGuard
  - OnboardingLayout
  - All route files and models

### Phase 5: Update Related Files
- Updated `feature/auth/login/login.ts`:
  - Changed "Créer un compte" link from `/onboarding/welcome` to `/welcome`
- Updated `core/storage/storage-keys.ts`:
  - Removed `ONBOARDING_DATA` and `ONBOARDING_COMPLETED` keys

### Phase 6: Unit Tests
- Created `feature/welcome/welcome-page.spec.ts` with 19 tests covering:
  - Component creation
  - Template elements (buttons, links, title)
  - Google OAuth flow (success, failure, exceptions)
  - Demo mode flow (Turnstile bypass, errors)
  - Loading states

## Deviations from Plan

1. **RouterLink test**: Changed test approach for login link from `button[routerLink="/login"]` selector to text content matching, as Angular bindings don't appear as attributes in the DOM.

2. **fakeAsync removal**: Replaced `fakeAsync`/`tick` with `async`/`await` in tests because the test environment doesn't have zone.js/testing configured.

3. **Router injection removed**: Removed unused `#router` injection from WelcomePage component (wasn't needed for the implementation).

## Test Results

- Typecheck: ✓
- Lint: ✓
- Format: ✓
- Unit Tests: ✓ (697 tests passed, including 19 new welcome-page tests)

## Flow Summary

**Before:**
```
/ → /onboarding/welcome → 8 more steps → /app/current-month
```

**After:**
```
/ → /welcome → /login (or Google OAuth) → /app/complete-profile → /app/current-month
```

## Follow-up Tasks

None identified. The implementation is complete and all tests pass.

## Files Changed Summary

**Created (4 files):**
- `frontend/projects/webapp/src/app/feature/welcome/welcome.routes.ts`
- `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`
- `frontend/projects/webapp/src/app/feature/welcome/welcome-page.spec.ts`
- `frontend/projects/webapp/src/app/feature/welcome/index.ts`

**Modified (6 files):**
- `frontend/projects/webapp/src/app/core/routing/routes-constants.ts`
- `frontend/projects/webapp/src/app/app.routes.ts`
- `frontend/projects/webapp/src/app/core/auth/auth-guard.ts`
- `frontend/projects/webapp/src/app/core/auth/public-guard.ts`
- `frontend/projects/webapp/src/app/feature/auth/login/login.ts`
- `frontend/projects/webapp/src/app/core/storage/storage-keys.ts`

**Deleted (entire directory):**
- `frontend/projects/webapp/src/app/feature/onboarding/` (all files)
