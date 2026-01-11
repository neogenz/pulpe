# Implementation Plan: Auth-First Onboarding Refactor

## Overview

Refactoring from a 9-step non-authenticated onboarding to a simplified auth-first approach:
- **Before:** `/onboarding/welcome` → 8 more steps → `/app`
- **After:** `/welcome` → `/login` (or Google OAuth) → `/app/complete-profile` → `/app/current-month`

**Key Decision:** Remove the entire onboarding feature, create a new standalone welcome page at root level, and leverage the existing CompleteProfile feature for profile completion post-authentication.

**Mode Demo:** Conserved with Turnstile protection.

---

## Dependencies

### Execution Order (Critical)

1. **Phase 1:** Create welcome feature (can be done in parallel with Phase 2)
2. **Phase 2:** Update routing constants (required before Phase 3)
3. **Phase 3:** Update app.routes.ts and guards
4. **Phase 4:** Delete old onboarding feature
5. **Phase 5:** Update related imports and fix broken references

### No Backend Changes Required

- `/budget-templates/from-onboarding` endpoint works as-is
- `ProfileSetupService` is already shared
- `hasBudgetGuard` redirects correctly to `/app/complete-profile`

---

## File Changes

### Phase 1: Create Welcome Feature

#### `frontend/projects/webapp/src/app/feature/welcome/welcome.routes.ts` (CREATE)

- Create route configuration file for welcome feature
- Define single route with empty path loading `WelcomePage` component
- Add route data with breadcrumb: 'Bienvenue' and icon: 'waving_hand'
- Export default routes array (follow pattern from `feature/legal/legal.routes.ts`)

#### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts` (CREATE)

- Create standalone component with `ChangeDetectionStrategy.OnPush`
- Reuse structure from `feature/onboarding/steps/welcome.ts`:
  - Lottie animation with `ngx-lottie` (same options, path: '/lottie/welcome-animation.json')
  - `@defer (on idle)` pattern for lazy Lottie loading
  - Turnstile integration for demo mode (same logic)
  - `DemoInitializerService` injection and usage
- **Template changes from original:**
  - Headline: "Bienvenue dans Pulpe" (keep)
  - Subheadline: Update to focus on value proposition, e.g., "Reprends le contrôle de tes finances en quelques minutes"
  - Primary CTA: "Continuer avec Google" button → calls `signInWithGoogle()`
  - Secondary CTA: "Utiliser mon email" button → navigates to `/login`
  - Tertiary: "Essayer le mode démo" button (keep existing logic)
  - Bottom link: "Déjà un compte ? Se connecter" → navigates to `/login`
- **Inject services:**
  - `Router` for navigation
  - `AuthApi` for Google OAuth
  - `DemoInitializerService` for demo mode
  - `Logger` for error logging
  - `ApplicationConfiguration` for Turnstile config
- **Methods:**
  - `signInWithGoogle()`: Call `authApi.signInWithGoogle()`, handle success/error
  - `navigateToLogin()`: Navigate to `['/', ROUTES.LOGIN]`
  - `startDemoMode()`: Copy Turnstile + demo logic from old welcome.ts
  - `onTurnstileResolved()`, `onTurnstileError()`: Copy from old welcome.ts
- Follow login.ts pattern for Google OAuth error handling
- Use Material v20 button syntax: `matButton="filled"`, `matButton="tonal"`, `matButton="outlined"`

#### `frontend/projects/webapp/src/app/feature/welcome/index.ts` (CREATE)

- Export routes from `./welcome.routes`
- No need to export component (lazy loaded)

---

### Phase 2: Update Routing Constants

#### `frontend/projects/webapp/src/app/core/routing/routes-constants.ts`

- Add constant: `WELCOME: 'welcome'` after `HOME: ''` (line 2)
- Remove onboarding step constants (lines 12-21):
  - `ONBOARDING_WELCOME`
  - `ONBOARDING_PERSONAL_INFO`
  - `ONBOARDING_income`
  - `ONBOARDING_HOUSING`
  - `ONBOARDING_HEALTH_INSURANCE`
  - `ONBOARDING_PHONE_PLAN`
  - `ONBOARDING_TRANSPORT`
  - `ONBOARDING_LEASING_CREDIT`
  - `ONBOARDING_REGISTRATION`
- Keep `ONBOARDING: 'onboarding'` temporarily for guard reference (will be unused after guard update)
- In `PAGE_TITLES`:
  - Keep `WELCOME: 'Bienvenue'` (already exists)
  - Remove onboarding step titles (lines 38-45):
    - `PERSONAL_INFO`, `HOUSING`, `income`, `HEALTH_INSURANCE`, `PHONE_PLAN`, `TRANSPORT`, `LEASING_CREDIT`, `REGISTRATION`

---

### Phase 3: Update Routing and Guards

#### `frontend/projects/webapp/src/app/app.routes.ts`

- **Line 7-11:** Change root redirect from `ROUTES.APP` to `ROUTES.WELCOME`
- **Line 13-17:** Add new welcome route BEFORE login route:
  ```
  path: ROUTES.WELCOME
  title: PAGE_TITLES.WELCOME
  canActivate: [publicGuard]
  loadChildren: () => import('./feature/welcome')
  ```
- **Line 19-23:** Remove entire `/onboarding` route block
- Update imports: Remove any onboarding-related imports if present
- Keep login route as-is (already has publicGuard)

#### `frontend/projects/webapp/src/app/core/auth/auth-guard.ts`

- **Line 28:** Change redirect destination from `ROUTES.ONBOARDING` to `ROUTES.WELCOME`
- This ensures unauthenticated users accessing `/app/*` are redirected to welcome page

#### `frontend/projects/webapp/src/app/core/auth/public-guard.ts`

- **Fallback redirect (error handler):** Change from `ROUTES.ONBOARDING` to `ROUTES.WELCOME`
- This is in the `.catch()` block when primary navigation fails

#### `frontend/projects/webapp/src/app/core/auth/index.ts`

- Verify exports are correct after changes
- No changes expected unless onboarding-specific exports exist

---

### Phase 4: Delete Old Onboarding Feature

#### `frontend/projects/webapp/src/app/feature/onboarding/` (DELETE ENTIRE DIRECTORY)

Files to delete:
- `onboarding.routes.ts`
- `onboarding-store.ts`
- `onboarding-store-unit.spec.ts`
- `onboarding-store-integration.spec.ts`
- `onboarding-state.ts`
- `onboarding-step-guard.ts`
- `onboarding-layout.ts`
- `index.ts`
- `steps/welcome.ts`
- `steps/registration.ts`
- `steps/income.ts`
- `steps/housing.ts`
- `steps/phone-plan.ts`
- `steps/transport.ts`
- `steps/leasing-credit.ts`
- `steps/health-insurance.ts`
- `ui/` directory (if contains onboarding-specific components)

---

### Phase 5: Update Login Page Reference

#### `frontend/projects/webapp/src/app/feature/auth/login/login.ts`

- **Line 182-183:** Change "Créer un compte" routerLink from `/onboarding/welcome` to `/welcome`
- This is the "Nouveau sur Pulpe ?" link at the bottom

---

### Phase 6: Cleanup (Optional but Recommended)

#### `frontend/projects/webapp/src/app/core/storage/storage-keys.ts`

- Remove `ONBOARDING_DATA` constant if present
- Remove any onboarding-related storage keys

#### `frontend/projects/webapp/src/app/ui/index.ts`

- Verify no onboarding-specific UI components are exported
- If `currency-input` was only used by onboarding, verify it's still needed by complete-profile (it is)

---

## Testing Strategy

### Unit Tests to Create

#### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.spec.ts`

- Test component creation
- Test Google OAuth button triggers `signInWithGoogle()`
- Test email button navigates to `/login`
- Test demo mode button triggers Turnstile flow
- Test Turnstile bypass in local environment
- Test error message display on OAuth failure
- Test loading states during OAuth/demo initialization
- Mock: `AuthApi`, `DemoInitializerService`, `Router`, `ApplicationConfiguration`
- Follow AAA pattern from existing specs

### Unit Tests to Update

None required - existing complete-profile tests remain valid.

### Integration Tests (E2E with Playwright)

#### `frontend/e2e/auth-first-flow.spec.ts` (CREATE or UPDATE existing auth tests)

Test scenarios:
1. New user: `/welcome` → Google OAuth → `/app/complete-profile` → fill form → `/app/current-month`
2. New user: `/welcome` → "Utiliser mon email" → `/login` → create account → `/app/complete-profile`
3. Returning user: `/welcome` → "Se connecter" → `/login` → credentials → `/app/current-month`
4. Demo mode: `/welcome` → "Essayer le mode démo" → demo initialized
5. Direct URL `/app/current-month` unauthenticated → redirects to `/welcome`
6. Direct URL `/app/current-month` authenticated without budget → redirects to `/app/complete-profile`
7. Direct URL `/welcome` authenticated → redirects to `/app/current-month`

### Manual Verification Checklist

- [ ] Fresh browser: Navigate to root `/` → redirects to `/welcome`
- [ ] Click "Continuer avec Google" → Google OAuth popup → success → redirects based on budget status
- [ ] Click "Utiliser mon email" → navigates to `/login`
- [ ] Click "Se connecter" → navigates to `/login`
- [ ] Demo mode works with Turnstile (non-local)
- [ ] Demo mode bypasses Turnstile (local)
- [ ] Lottie animation loads correctly
- [ ] Mobile responsive layout
- [ ] Accessibility: keyboard navigation, focus management

---

## Documentation

No documentation updates required - this is an internal refactor with no API changes.

---

## Rollout Considerations

### No Migration Needed

- No existing users in production
- No localStorage migration required
- No 301 redirects needed for old URLs

### Feature Flag

Not required - this is a complete replacement, not a gradual rollout.

### Breaking Changes

- Old onboarding URLs (`/onboarding/*`) will 404
- Acceptable per product decision (no public users yet)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Demo mode breaks | Low | Medium | Preserve exact Turnstile logic from old welcome.ts |
| OAuth redirect issues | Low | High | Test thoroughly, follow existing login.ts pattern |
| Guard chain breaks | Low | High | Test all redirect scenarios in E2E |
| Missing imports after deletion | Medium | Low | Run `pnpm quality` to catch TypeScript errors |

---

## Summary

This plan transforms a 9-step onboarding into a streamlined 3-4 screen auth-first flow:

1. **Create:** New `/welcome` page with Google OAuth, email option, and demo mode
2. **Update:** Routing to redirect root to `/welcome`, guards to redirect to `/welcome`
3. **Delete:** Entire `feature/onboarding/` directory (9 components, store, guards)
4. **Reuse:** Existing `CompleteProfile` feature for post-auth profile setup

**Estimated scope:** ~400 lines new code, ~2000 lines deleted, 8 files modified.

---

## Next Steps

Run `/epct:tasks 28-auth-first-onboarding-refactor` to divide this plan into executable task files, or `/epct:code 28-auth-first-onboarding-refactor` to execute directly.
