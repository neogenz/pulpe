# Task: Create Welcome Page Feature

## Problem

The current onboarding flow is a 9-step process that starts before authentication. We need a new welcome page that serves as the entry point for unauthenticated users, offering Google OAuth as the primary authentication method, email login as secondary, and demo mode access.

## Proposed Solution

Create a new `feature/welcome/` module with a standalone welcome page component. The page will:
- Display value proposition with Lottie animation (reused from old welcome)
- Offer "Continuer avec Google" as primary CTA (Google OAuth)
- Provide "Utiliser mon email" as secondary option (navigates to /login)
- Keep "Essayer le mode démo" with Turnstile protection
- Include "Déjà un compte ? Se connecter" link

## Dependencies

- None (can start immediately)
- This task creates the new feature that will replace the old onboarding entry point

## Context

- **Pattern to follow:** `feature/auth/login/login.ts` for Google OAuth handling
- **Reuse from:** `feature/onboarding/steps/welcome.ts` for Lottie animation and Turnstile logic
- **Services needed:** `AuthApi`, `DemoInitializerService`, `Router`, `Logger`, `ApplicationConfiguration`
- **Material v20 syntax:** `matButton="filled"`, `matButton="tonal"`, `matButton="outlined"`

### Files to create:
- `feature/welcome/welcome-page.ts` - Main component
- `feature/welcome/welcome.routes.ts` - Route configuration
- `feature/welcome/index.ts` - Public exports

## Success Criteria

- [ ] Component renders with Lottie animation (deferred loading)
- [ ] "Continuer avec Google" triggers Google OAuth flow
- [ ] "Utiliser mon email" navigates to `/login`
- [ ] Demo mode works with Turnstile (or bypasses in local env)
- [ ] "Se connecter" link navigates to `/login`
- [ ] Error states display correctly (OAuth failures, Turnstile errors)
- [ ] Loading states show during async operations
- [ ] Component uses `ChangeDetectionStrategy.OnPush`
- [ ] Routes file exports default array for lazy loading
