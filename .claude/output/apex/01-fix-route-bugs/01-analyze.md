# Step 01: Analyze

**Task:** Fix route bugs found in code review
**Started:** 2026-01-19T12:01:00Z

---

## Context Discovery

### Bug 1: Missing Default Redirect (BLOCKING)

**File:** `app.routes.ts:43-84`

The main layout route has `path: ''` with children but NO default redirect:
- Children: `complete-profile`, `dashboard`, `budget`, `budget-templates`, `settings`
- When authenticated user visits `/`, main layout renders but router-outlet is empty

**Fix needed:** Add `{ path: '', redirectTo: ROUTES.DASHBOARD, pathMatch: 'full' }` as first child

### Bug 2: Hardcoded Route Strings (MAINTAINABILITY)

| File | Line | Hardcoded | Should Use |
|------|------|-----------|------------|
| `auth-oauth.service.ts` | 56 | `'/dashboard'` | `ROUTES.DASHBOARD` |
| `has-budget.guard.ts` | 21 | `'/complete-profile'` | `ROUTES.COMPLETE_PROFILE` |
| `public-guard.ts` | 24 | `'/dashboard'` | `ROUTES.DASHBOARD` |
| `demo-initializer.service.ts` | 100, 172 | `'/dashboard'` | `ROUTES.DASHBOARD` |
| `login.ts` | 228 | `'/dashboard'` | `ROUTES.DASHBOARD` |
| `signup.ts` | 353 | `'/dashboard'` | `ROUTES.DASHBOARD` |
| `complete-profile-page.ts` | 223, 238 | `'/dashboard'` | `ROUTES.DASHBOARD` |
| `main-layout.ts` | 405 | `'/settings'` | `ROUTES.SETTINGS` |

### ROUTES Constants Available

```typescript
// routes-constants.ts
export const ROUTES = {
  HOME: '',
  WELCOME: 'welcome',
  LOGIN: 'login',
  SIGNUP: 'signup',
  DASHBOARD: 'dashboard',           // ← Use this
  COMPLETE_PROFILE: 'complete-profile', // ← Use this
  BUDGET: 'budget',
  BUDGET_TEMPLATES: 'budget-templates',
  SETTINGS: 'settings',             // ← Use this
  // ...
} as const;
```

### Navigation Pattern Observed

Routes use absolute paths with leading `/`:
- `router.navigate(['/dashboard'])`
- `router.createUrlTree(['/complete-profile'])`

Should use:
- `router.navigate(['/', ROUTES.DASHBOARD])`
- `router.createUrlTree(['/', ROUTES.COMPLETE_PROFILE])`

---

## Acceptance Criteria

- [x] AC1: Add default redirect from `/` to `/dashboard` in main layout children
- [ ] AC2: Replace hardcoded route strings with ROUTES constants (8 files)
- [ ] AC3: Tests pass after changes
- [ ] AC4: `pnpm quality` passes

---

## Step Complete

**Status:** ✓ Complete
**Files found:** 9
**Patterns identified:** 2 (absolute routes, ROUTES constants)
**Next:** step-02-plan.md
**Timestamp:** 2026-01-19T12:02:00Z
