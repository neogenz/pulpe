# Implementation Plan: Google OAuth & Onboarding Improvements

## Overview

This plan addresses critical issues in the OAuth/onboarding flow, improves UX consistency, and adds analytics tracking for funnel conversion. The implementation follows Angular 20+ best practices with signals, OnPush change detection, and the project's store pattern.

**Key decisions from user:**
- Scope: All phases (critical + UX + analytics + E2E tests)
- CGU for OAuth: Mention texte sous le bouton Google (pas de checkbox)
- Container width: Keep `max-w-2xl` on complete-profile (current)

## Dependencies

Files must be modified in this order due to dependencies:
1. `auth-api.ts` - Add OAuth user metadata access helper + explicit redirectTo
2. `complete-profile-store.ts` - Add prefill method + analytics
3. `complete-profile-page.ts` - Call store methods on init
4. `welcome-page.ts` - Add CGU text mention + analytics
5. `login.ts` - Fix link to direct signup
6. `auth-error-localizer.ts` - Handle OAuth cancellation error
7. Tests for each modified file
8. E2E tests for complete-profile flow

---

## Phase 1: Critical Fixes

### `frontend/projects/webapp/src/app/core/auth/auth-api.ts`

- Add helper method `getOAuthUserMetadata()` that extracts `given_name` and `full_name` from `session.user.user_metadata`
- Return type: `{ givenName?: string; fullName?: string }` or null if no session
- This keeps OAuth metadata extraction centralized in auth layer
- Pattern: Follow existing computed signal style (`readonly session = this.#sessionSignal.asReadonly()`)

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts`

- Add injection of `AuthApi` service
- Add new method `prefillFromOAuthMetadata(): void`
  - Read `AuthApi.getOAuthUserMetadata()`
  - If `givenName` exists, call `updateFirstName(givenName)`
  - Else if `fullName` exists, call `updateFirstName(fullName.split(' ')[0])`
  - This is synchronous, no state flags needed
- **No change to state interface** - `checkExistingBudgets()` already returns a boolean directly
- Keep the method as-is, the component will use the return value

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts`

- In constructor, add initialization logic:
  ```typescript
  constructor() {
    this.store.prefillFromOAuthMetadata(); // sync - prefills firstName if OAuth
    void this.#initPage();
  }

  async #initPage(): Promise<void> {
    const hasExisting = await this.store.checkExistingBudgets();
    if (hasExisting) {
      this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
    }
  }
  ```
- **Simple approach**: Use the boolean return directly, no need for signals/effects/computed
- Order matters: prefill runs immediately, spinner shows while checking budgets

---

## Phase 2: UX & Legal Improvements

### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`

- Add CGU text mention **under** the Google OAuth button (not a checkbox):
  ```html
  <pulpe-google-oauth-button ... />
  <p class="text-body-small text-on-surface-variant text-center mt-2 max-w-sm">
    En continuant avec Google, j'accepte les
    <a [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]" target="_blank" class="text-primary underline">CGU</a>
    et la
    <a [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]" target="_blank" class="text-primary underline">Politique de Confidentialité</a>
  </p>
  ```
- No checkbox, no blocking - just informational text
- Consistent with email signup flow (which has its own checkbox in /signup)

### `frontend/projects/webapp/src/app/feature/auth/login/login.ts`

- Line 154: Change `routerLink="/welcome"` to `[routerLink]="['/', ROUTES.SIGNUP]"`
- This removes the detour through welcome page when creating account from login
- Ensure ROUTES is imported (already is: line 18)

### `frontend/projects/webapp/src/app/core/auth/auth-api.ts` (additional change)

- Modify `signInWithGoogle()` method (lines 253-278)
- Add explicit `redirectTo` option pointing to `/app` (let guards handle the rest):
  ```typescript
  const { error } = await this.#supabaseClient!.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/${ROUTES.APP}`
    }
  });
  ```
- Import `ROUTES` from `@core/routing/routes-constants`
- **Rationale**: Redirect to `/app` instead of `/app/current-month` to let `hasBudgetGuard` handle routing to complete-profile if needed (avoids flash)

### `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.ts`

- Check if OAuth cancellation error is handled
- If not, add localization for Supabase OAuth errors:
  - `access_denied` → "Connexion annulée"
  - `user_cancelled_login` → "Connexion annulée"
- Pattern: Follow existing error message mapping in `AUTH_ERROR_MESSAGES`
- **Note**: OAuth cancellation testing will be unit tests only (E2E impossible due to external Google redirect)

---

## Phase 3: Analytics & Monitoring

### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts` (additional changes)

- Inject `PostHogService`
- Add analytics event when OAuth button clicked:
  - Event: `signup_started`
  - Properties: `{ method: 'google' }`
- Add analytics event when email signup clicked:
  - Event: `signup_started`
  - Properties: `{ method: 'email' }`

### `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts`

- Inject `PostHogService`
- In `signUp()` method after successful signup:
  - Event: `signup_completed`
  - Properties: `{ method: 'email' }`
- Note: Google OAuth users don't go through signup.ts, they go directly to complete-profile

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts` (additional changes)

- Add analytics events in `submitProfile()` after successful budget creation:
  - Event: `first_budget_created` (more accurate than `signup_completed` for OAuth users)
  - Properties:
    ```typescript
    {
      signup_method: this.#determineSignupMethod(), // 'google' | 'email'
      has_pay_day: state.payDayOfMonth !== null,
      charges_count: this.#countOptionalCharges(state)
    }
    ```
- Add private method `#determineSignupMethod(): 'google' | 'email'`:
  - Check `AuthApi.getOAuthUserMetadata()` - if has Google metadata → 'google'
  - Else → 'email'
- Add private method `#countOptionalCharges(state)`: count non-null optional charges (housing, health, phone, transport, leasing)
- **Distinguishing first-time vs returning**: `first_budget_created` only fires when budget is actually created in complete-profile. Returning users with existing budgets are redirected before reaching submitProfile.

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts` (additional changes)

- Inject `PostHogService`
- Track step 1 completion when user clicks "Suivant":
  - Add click handler or intercept stepper navigation
  - Event: `profile_step1_completed`
- Track step 2 completion when user clicks "Créer mon budget":
  - Event: `profile_step2_completed` if any optional charge filled
  - Event: `profile_step2_skipped` if all optional charges are null/zero

---

## Testing Strategy

### Unit Tests to Update

#### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.spec.ts`

- Add test for `prefillFromOAuthMetadata()`:
  - Mock AuthApi with OAuth metadata (givenName) → firstName should be set
  - Mock AuthApi with OAuth metadata (fullName only) → firstName should be first word
  - Mock AuthApi without metadata → firstName should remain empty
- Add tests for analytics events captured during profile completion
- Add test for `#determineSignupMethod()` logic
- Mock PostHogService.captureEvent and verify calls

#### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.spec.ts`

- Add test: CGU text is visible below Google OAuth button
- Add test: Analytics event fired when Google OAuth clicked
- Add test: Analytics event fired when email signup clicked

#### `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts` (create if doesn't exist)

- Test `getOAuthUserMetadata()` returns correct data from session
- Test `getOAuthUserMetadata()` returns null when no session
- Test `signInWithGoogle()` includes redirectTo option with correct URL

#### `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.spec.ts`

- Test OAuth cancellation errors are properly localized
- Test `access_denied` → "Connexion annulée"

### E2E Tests to Create

#### `frontend/e2e/tests/features/complete-profile.spec.ts` (new file)

- Test: User with existing budget navigating to complete-profile redirects to dashboard
- Test: First-time user can complete profile flow (steps 1 and 2)
- Test: OAuth user has firstName pre-filled (mock OAuth session metadata)
- Test: Skip step 2 and create budget with minimal info
- Test: Fill step 2 charges and create budget
- Pattern: Follow existing `authentication.spec.ts` structure
- Use authenticated fixture with mock session containing OAuth metadata

**Note**: OAuth flow E2E tests are limited to mocked scenarios. Real OAuth redirect (Google) cannot be tested in E2E.

---

## Documentation

No documentation updates required - these are internal implementation changes.

---

## Rollout Considerations

### Breaking Changes
- None - all changes are additive or fix existing behavior

### Feature Flags
- None required - changes are improvements to existing flows

### Migration Steps
1. Deploy auth-api changes first (backward compatible)
2. Deploy complete-profile changes
3. Deploy welcome-page CGU text + analytics
4. Deploy login link fix
5. Deploy analytics last (least critical)

### Risk Assessment
- **Low risk**: Login link change, CGU text mention, analytics additions
- **Medium risk**: redirectTo change (verify Supabase handles it correctly)
- **High risk**: checkExistingBudgets redirect (test thoroughly to avoid loops)

### Monitoring
- Watch PostHog funnel events after deployment:
  - `signup_started` (method: google vs email)
  - `first_budget_created`
  - `profile_step1_completed`, `profile_step2_completed/skipped`
- Check for redirect loops in complete-profile

---

## Summary

| Phase | Files | Priority |
|-------|-------|----------|
| 1 | auth-api.ts, complete-profile-store.ts, complete-profile-page.ts | Critical |
| 2 | welcome-page.ts, login.ts, auth-error-localizer.ts | UX/Legal |
| 3 | welcome-page.ts, signup.ts, complete-profile-store.ts, complete-profile-page.ts | Analytics |
| Tests | *.spec.ts, complete-profile.spec.ts (E2E) | Quality |

---

## Corrections Applied (from review)

1. **redirectTo**: Changed from `/app/current-month` to `/app` to let guards handle routing
2. **google-oauth-button.ts**: Removed from dependencies (no changes needed)
3. **CGU**: Changed from checkbox to text mention (UX consistency)
4. **hasExistingBudgets**: Simplified - use return value directly, no computed/signal needed
5. **Analytics**: Use `first_budget_created` event, distinguish first-time vs returning via existing budget check
6. **OAuth cancellation test**: Clarified as unit test only (E2E impossible)
