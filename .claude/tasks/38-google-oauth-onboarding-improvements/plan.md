# Implementation Plan: Google OAuth & Onboarding Improvements

## Overview

This plan addresses critical issues in the OAuth/onboarding flow, improves UX consistency, and adds analytics tracking for funnel conversion. The implementation follows Angular 20+ best practices with signals, OnPush change detection, and the project's store pattern.

**Key decisions from user:**
- Scope: All phases (critical + UX + analytics + E2E tests)
- CGU for OAuth: Checkbox obligatoire on welcome page
- Container width: Keep `max-w-2xl` on complete-profile (current)

## Dependencies

Files must be modified in this order due to dependencies:
1. `auth-api.ts` - Add OAuth user metadata access helper
2. `complete-profile-store.ts` - Add init method with OAuth prefill + analytics
3. `complete-profile-page.ts` - Call store init on component creation
4. `welcome-page.ts` - Add CGU checkbox for OAuth
5. `login.ts` - Fix link to direct signup
6. `google-oauth-button.ts` - Add redirectTo option
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
- Modify `checkExistingBudgets()` to update internal state with `hasExistingBudgets: boolean` (already logs but doesn't store)
- Add computed `readonly shouldRedirectToDashboard = computed(() => this.#state().hasExistingBudgets)`
- Note: State interface needs `hasExistingBudgets: boolean` field (default `false`)

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts`

- Import `effect` from `@angular/core`
- In constructor:
  1. Call `this.store.prefillFromOAuthMetadata()` (sync - prefills firstName if OAuth)
  2. Call `void this.store.checkExistingBudgets()` (async - sets spinner, checks budgets)
- Add `effect()` to watch `store.shouldRedirectToDashboard()`:
  - If `true`, navigate to `['/', ROUTES.APP, ROUTES.CURRENT_MONTH]`
  - Use `untracked()` for router navigation to avoid tracking
- Order matters: prefill runs immediately, spinner shows while checking budgets

---

## Phase 2: UX & Legal Improvements

### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`

- Import `MatCheckboxModule` from `@angular/material/checkbox`
- Add to imports array
- Add signal: `readonly #acceptedTerms = signal(false)`
- Expose: `readonly acceptedTerms = this.#acceptedTerms.asReadonly()`
- Add computed: `readonly canUseOAuth = computed(() => this.#acceptedTerms())`
- Add checkbox before Google OAuth button in template:
  ```html
  <mat-checkbox
    [ngModel]="acceptedTerms()"
    (ngModelChange)="onTermsChange($event)"
    data-testid="oauth-accept-terms-checkbox"
  >
    <span class="text-body-small">
      J'accepte les <a routerLink="/legal/terms" target="_blank">CGU</a>
      et la <a routerLink="/legal/privacy" target="_blank">Politique de Confidentialité</a>
    </span>
  </mat-checkbox>
  ```
- Add method `onTermsChange(value: boolean): void { this.#acceptedTerms.set(value); }`
- Disable Google OAuth button when `!canUseOAuth()`
- Import `FormsModule` for `ngModel` binding
- Consider: Update existing `isLoading()` computed to include `!canUseOAuth()` check for disabled state

### `frontend/projects/webapp/src/app/feature/auth/login/login.ts`

- Line 154: Change `routerLink="/welcome"` to `[routerLink]="['/', ROUTES.SIGNUP]"`
- This removes the detour through welcome page when creating account from login
- Ensure ROUTES is imported (already is: line 18)

### `frontend/projects/webapp/src/app/core/auth/auth-api.ts` (additional change)

- Modify `signInWithGoogle()` method (lines 253-278)
- Add explicit `redirectTo` option:
  ```typescript
  const { error } = await this.#supabaseClient!.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/${ROUTES.APP}/${ROUTES.CURRENT_MONTH}`
    }
  });
  ```
- Import `ROUTES` from `@core/routing/routes-constants`
- Consider: This makes the redirect explicit rather than relying on Supabase dashboard config

### `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.ts`

- Check if OAuth cancellation error is handled
- If not, add localization for "user_cancelled" or equivalent Supabase error
- Pattern: Follow existing error message mapping in `AUTH_ERROR_MESSAGES`
- Need to verify exact error message from Supabase for OAuth cancellation

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
- In Google OAuth button handler (via output):
  - Event already captured in welcome-page (if user came from there)
  - If direct access to signup, capture `signup_started` with method 'google'

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts` (additional changes)

- Add analytics events:
  1. In `submitProfile()` after successful budget creation:
     - Event: `profile_completed`
     - Properties: `{ signup_method: 'google' | 'email', has_pay_day: boolean, charges_count: number }`
  2. Need to track signup method - add to state or read from AuthApi metadata
- Add method to count optional charges filled (housing, health, phone, transport, leasing)
- Pattern: Follow existing PostHog usage in the store

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts` (additional changes)

- Track step completion:
  - When user clicks "Suivant" on step 1: `profile_step1_completed`
  - When user clicks "Créer mon budget": `profile_step2_completed` or `profile_step2_skipped` (based on optional fields)

---

## Testing Strategy

### Unit Tests to Update

#### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.spec.ts`

- Add test for `prefillFromOAuthMetadata()`:
  - Mock AuthApi with OAuth metadata → firstName should be set
  - Mock AuthApi without metadata → firstName should remain empty
- Add test for `shouldRedirectToDashboard` computed
- Add tests for analytics events captured during profile completion
- Mock PostHogService.captureEvent and verify calls

#### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.spec.ts`

- Add test: CGU checkbox unchecked → Google OAuth button disabled
- Add test: CGU checkbox checked → Google OAuth button enabled
- Add test: Analytics event fired when signup methods clicked

#### `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts` (create if doesn't exist)

- Test `getOAuthUserMetadata()` returns correct data from session
- Test `signInWithGoogle()` includes redirectTo option

### E2E Tests to Create

#### `frontend/e2e/tests/features/complete-profile.spec.ts` (new file)

- Test: User with existing budget navigating to complete-profile redirects to dashboard
- Test: First-time user can complete profile flow (steps 1 and 2)
- Test: OAuth user has firstName pre-filled (mock OAuth session metadata)
- Test: Skip step 2 and create budget with minimal info
- Test: Fill step 2 charges and create budget
- Pattern: Follow existing `authentication.spec.ts` structure
- Use authenticated fixture with mock session containing OAuth metadata

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
3. Deploy welcome-page CGU checkbox
4. Deploy analytics last (least critical)

### Risk Assessment
- **Low risk**: Login link change, analytics additions
- **Medium risk**: CGU checkbox (may affect conversion - monitor)
- **High risk**: checkExistingBudgets redirect (test thoroughly to avoid loops)

### Monitoring
- Watch PostHog funnel events after deployment
- Monitor for increased dropout at CGU checkbox step
- Check for redirect loops in complete-profile

---

## Summary

| Phase | Files | Priority |
|-------|-------|----------|
| 1 | auth-api.ts, complete-profile-store.ts, complete-profile-page.ts | Critical |
| 2 | welcome-page.ts, login.ts, auth-error-localizer.ts | UX/Legal |
| 3 | welcome-page.ts, signup.ts, complete-profile-store.ts, complete-profile-page.ts | Analytics |
| Tests | *.spec.ts, complete-profile.spec.ts (E2E) | Quality |
