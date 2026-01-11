# Implementation Plan: Critical Issues Before Merge

## Overview

Fix 4 critical issues identified during code review:
1. **Signup tests** - Create comprehensive test suite for 412-line component
2. **CurrencyInput tests** - Add tests for reusable UI component
3. **Password magic number** - Extract PASSWORD_MIN_LENGTH to shared constant
4. **OAuth duplication** - Create reusable GoogleOAuthButton pattern component

**Architecture decisions:**
- Google OAuth button → `pattern/google-oauth/` (state-aware, reusable across features)
- PASSWORD_MIN_LENGTH → `core/auth/auth-constants.ts` (shared constant)

---

## Dependencies

Execute in this order:
1. **core/auth/auth-constants.ts** - Create constants first (used by other files)
2. **pattern/google-oauth/** - Create pattern component (used by 3 pages)
3. **signup.ts magic number fix** - Use new constant
4. **login.ts magic number fix** - Use new constant
5. **Update 3 pages** - Use new GoogleOAuthButton pattern
6. **signup.spec.ts** - Create tests (after refactoring complete)
7. **currency-input.spec.ts** - Create tests (independent)

---

## File Changes

### `frontend/projects/webapp/src/app/core/auth/auth-constants.ts` (CREATE)

- Create new file for auth-related constants
- Export `PASSWORD_MIN_LENGTH = 8`
- Export `PASSWORD_MIN_LENGTH_ERROR_MESSAGE` for French error message consistency
- Follow pattern from `core/routing/routes-constants.ts`

### `frontend/projects/webapp/src/app/core/auth/index.ts` (UPDATE)

- Add export for `auth-constants` barrel export

---

### `frontend/projects/webapp/src/app/pattern/google-oauth/google-oauth-button.ts` (CREATE)

- Create standalone component `GoogleOAuthButton`
- Selector: `pulpe-google-oauth-button`
- Use OnPush change detection
- Inject `AuthApi` from `@core/auth/auth-api`
- Inject `Logger` from `@core/logging/logger`
- Inputs:
  - `buttonLabel = input<string>('Continuer avec Google')` - Customizable label
  - `buttonType = input<'filled' | 'outlined'>('outlined')` - Button style variant
  - `testId = input<string>('google-oauth-button')` - For E2E testing
- Outputs:
  - `loading = output<boolean>()` - Emit loading state changes
  - `error = output<string>()` - Emit error messages
- Internal signals:
  - `isLoading = signal<boolean>(false)`
- Method `signInWithGoogle()`:
  - Set isLoading true, emit loading(true)
  - Call `authApi.signInWithGoogle()`
  - On failure: emit error message, reset isLoading
  - On catch: log error, emit generic error, reset isLoading
- Template: Material button with Google icon and progress spinner
- Follow pattern from existing `welcome-page.ts:248-266`

### `frontend/projects/webapp/src/app/pattern/google-oauth/google-oauth-button.spec.ts` (CREATE)

- Test component structure and signal properties
- Test signInWithGoogle() success path (no error emitted)
- Test signInWithGoogle() failure path (error emitted)
- Test signInWithGoogle() exception path (logs error, emits generic message)
- Test loading state changes
- Test button disabled state when loading
- Mock AuthApi with vi.fn()
- Follow pattern from `edit-transaction-form.spec.ts`

### `frontend/projects/webapp/src/app/pattern/google-oauth/index.ts` (CREATE)

- Barrel export for GoogleOAuthButton

---

### `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts` (UPDATE)

- Import `PASSWORD_MIN_LENGTH` from `@core/auth/auth-constants`
- Line 320: Replace `Validators.minLength(8)` with `Validators.minLength(PASSWORD_MIN_LENGTH)`
- Import `GoogleOAuthButton` from `@app/pattern/google-oauth`
- Add to component imports array
- Replace Google OAuth button template (lines 270-282) with `<pulpe-google-oauth-button>`
- Handle `(error)` output to set `errorMessage` signal
- Handle `(loading)` output to update `isSubmitting` signal appropriately
- Remove `signUpWithGoogle()` method (lines 391-411)

### `frontend/projects/webapp/src/app/feature/auth/signup/signup.spec.ts` (CREATE)

- Setup TestBed with:
  - Import Signup component
  - provideZonelessChangeDetection()
  - Mock AuthApi, Router, Logger
- **passwordsMatchValidator tests** (can test standalone function):
  - Return null when both fields empty
  - Return null when passwords match
  - Return `{ passwordsMismatch: true }` when passwords differ
  - Set error on confirmPassword control when mismatch
- **Form validation tests**:
  - Email required and format validation
  - Password required and minLength validation
  - ConfirmPassword required validation
  - AcceptTerms requiredTrue validation
  - Form invalid when any field fails
  - Form valid when all fields pass
- **canSubmit computed tests**:
  - Returns false when form invalid
  - Returns false when isSubmitting true
  - Returns true when form valid and not submitting
- **signUp() method tests**:
  - Early return and mark touched when form invalid
  - Sets isSubmitting true and clears error on valid submit
  - Navigates to app on success
  - Sets errorMessage on API failure
  - Sets errorMessage on exception
  - Resets isSubmitting on error
- **Helper method tests**:
  - togglePasswordVisibility flips hidePassword signal
  - toggleConfirmPasswordVisibility flips hideConfirmPassword signal
  - clearMessages resets errorMessage to empty string
- Follow AAA pattern with blank line separation
- Reference pattern from `edit-transaction-form.spec.ts`

---

### `frontend/projects/webapp/src/app/feature/auth/login/login.ts` (UPDATE)

- Import `PASSWORD_MIN_LENGTH` from `@core/auth/auth-constants`
- Line 204: Replace `Validators.minLength(8)` with `Validators.minLength(PASSWORD_MIN_LENGTH)`
- Import `GoogleOAuthButton` from `@app/pattern/google-oauth`
- Add to component imports array
- Replace Google OAuth button template (lines 161-173) with `<pulpe-google-oauth-button>`
- Handle `(error)` output to set `errorMessage` signal
- Handle `(loading)` output to manage loading state
- Remove `signInWithGoogle()` method (lines 270-290)

---

### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts` (UPDATE)

- Import `GoogleOAuthButton` from `@app/pattern/google-oauth`
- Add to component imports array
- Replace Google OAuth button template (lines 85-110) with `<pulpe-google-oauth-button>`
- Pass `buttonType="filled"` to match current filled style
- Handle `(error)` output to set `errorMessage` signal
- Handle `(loading)` output to update `isGoogleLoading` signal
- Remove `signInWithGoogle()` method (lines 248-266)
- Keep `isGoogleLoading` signal for template disabled state (shared with demo button)

---

### `frontend/projects/webapp/src/app/ui/currency-input/currency-input.spec.ts` (CREATE)

- Setup TestBed with:
  - Import CurrencyInput component
  - provideZonelessChangeDetection()
  - FormsModule, MatFormFieldModule, MatInputModule
  - provideAnimationsAsync()
- **Component structure tests**:
  - Has required signal inputs defined (label)
  - Has optional signal inputs with defaults (placeholder, currency, required, testId, autoFocus)
  - Has model() for value two-way binding
- **Input defaults tests**:
  - placeholder defaults to '0.00'
  - currency defaults to 'CHF'
  - required defaults to false
  - testId defaults to 'currency-input'
  - autoFocus defaults to true
- **onInput() method tests**:
  - Parses valid numeric input and sets value
  - Sets null for empty input
  - Sets null for non-numeric input (NaN case)
  - Handles decimal values correctly
- **model() binding tests**:
  - Initial value is null
  - value.set() updates the model
- Follow pattern from `breadcrumb.spec.ts` for signal input testing

---

## Testing Strategy

### Tests to Create
| File | Test Count | Priority |
|------|------------|----------|
| `signup.spec.ts` | ~20 tests | High |
| `currency-input.spec.ts` | ~10 tests | Medium |
| `google-oauth-button.spec.ts` | ~8 tests | High |

### Test Patterns to Use
- **Vitest** with `describe`, `it`, `expect`, `vi`, `beforeEach`
- **TestBed** with `provideZonelessChangeDetection()`
- **Mocking**: `vi.fn().mockResolvedValue()` for async methods
- **AAA Pattern**: Arrange, Act, Assert with blank lines
- **Signal testing**: Call signal as function `component.signal()`

### Manual Verification
1. Run `pnpm quality` - all checks pass
2. Run `pnpm test` - all tests pass
3. Test manually:
   - Signup form validation works
   - Google OAuth button works on all 3 pages
   - CurrencyInput works in budget creation flow

---

## Documentation

No documentation updates required - internal refactoring only.

---

## Rollout Considerations

### Breaking Changes
- None - all changes are internal refactoring

### Migration Steps
1. Create new files first (constants, pattern component)
2. Update existing files to use new abstractions
3. Remove duplicated code
4. Add tests

### Feature Flags
- None required - direct replacement

### Backwards Compatibility
- GoogleOAuthButton pattern maintains identical UI/UX
- Error handling behavior preserved
- Loading states work identically

---

## Summary

| Issue | Files Modified | New Files | Complexity |
|-------|---------------|-----------|------------|
| 1. Signup tests | 0 | 1 | Medium |
| 2. CurrencyInput tests | 0 | 1 | Low |
| 3. Magic number | 2 (signup, login) | 1 (constants) | Trivial |
| 4. OAuth duplication | 3 (signup, login, welcome) | 2 (component, test) | Medium |

**Total:** 5 modified files, 5 new files

---

## Next Step

Run `/epct:code .claude/tasks/01-critical-issues-fix` to execute this plan.
