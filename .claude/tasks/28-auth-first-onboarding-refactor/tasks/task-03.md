# Task: Update App Routes and Auth Guards

## Problem

The application routes still point to the old onboarding flow. Auth guards redirect unauthenticated users to `/onboarding` instead of the new `/welcome` page. The root redirect goes to `/app` instead of `/welcome`.

## Proposed Solution

Update routing configuration and guards to:
- Change root redirect from `/app` to `/welcome`
- Add new `/welcome` route with `publicGuard`
- Remove `/onboarding` route entirely
- Update `authGuard` to redirect to `/welcome` instead of `/onboarding`
- Update `publicGuard` fallback to redirect to `/welcome`

## Dependencies

- **Task 1:** Welcome feature must exist for route to work
- **Task 2:** `ROUTES.WELCOME` constant must exist

## Context

### Files to modify:
- `app.routes.ts` - Main routing configuration
- `core/auth/auth-guard.ts` - Redirect destination for unauthenticated users
- `core/auth/public-guard.ts` - Fallback redirect in error handler

### Key changes:
- Root redirect: `ROUTES.APP` → `ROUTES.WELCOME`
- authGuard line 28: `ROUTES.ONBOARDING` → `ROUTES.WELCOME`
- publicGuard fallback: `ROUTES.ONBOARDING` → `ROUTES.WELCOME`

### Route structure after changes:
```
'' → /welcome (redirect)
/welcome → WelcomePage (publicGuard)
/login → Login (publicGuard)
/app/* → Protected routes (authGuard)
```

## Success Criteria

- [ ] Navigating to `/` redirects to `/welcome`
- [ ] `/welcome` loads the new WelcomePage component
- [ ] `/welcome` is protected by `publicGuard` (authenticated users redirected away)
- [ ] Unauthenticated access to `/app/*` redirects to `/welcome`
- [ ] `/onboarding` route removed from configuration
- [ ] Guards use `ROUTES.WELCOME` for redirects
- [ ] TypeScript compiles without errors
