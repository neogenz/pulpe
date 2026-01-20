# Step 02: Plan

**Task:** Fix route bugs found in code review
**Started:** 2026-01-19T12:03:00Z

---

## Implementation Plan: Fix Route Bugs

### Overview

Fix two routing issues: (1) add missing default redirect for authenticated users at `/`, and (2) replace hardcoded route strings with `ROUTES` constants for maintainability.

### Prerequisites
- None - straightforward edits

---

### File Changes

#### 1. `app.routes.ts` (BLOCKING BUG FIX)

**Location:** Line 47 (after `children: [`)

**Change:** Add default redirect as first child route:
```typescript
{ path: '', redirectTo: ROUTES.DASHBOARD, pathMatch: 'full' },
```

This ensures authenticated users at `/` are redirected to `/dashboard`.

---

#### 2. `core/auth/auth-oauth.service.ts`

**Location:** Line 56

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace: `'/dashboard'` → `` `${window.location.origin}/${ROUTES.DASHBOARD}` ``

---

#### 3. `core/auth/has-budget.guard.ts`

**Location:** Line 21

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace: `['/complete-profile']` → `['/', ROUTES.COMPLETE_PROFILE]`

---

#### 4. `core/auth/public-guard.ts`

**Location:** Line 24

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace: `['/dashboard']` → `['/', ROUTES.DASHBOARD]`

---

#### 5. `core/demo/demo-initializer.service.ts`

**Locations:** Lines 100, 172

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace both: `['/dashboard']` → `['/', ROUTES.DASHBOARD]`

---

#### 6. `feature/auth/login/login.ts`

**Location:** Line 228

**Note:** Already imports `ROUTES` at line 18

**Change:**
- Replace: `['/dashboard']` → `['/', ROUTES.DASHBOARD]`

---

#### 7. `feature/auth/signup/signup.ts`

**Location:** Line 353

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace: `['/dashboard']` → `['/', ROUTES.DASHBOARD]`

---

#### 8. `feature/complete-profile/complete-profile-page.ts`

**Locations:** Lines 223, 238

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace both: `['/dashboard']` → `['/', ROUTES.DASHBOARD]`

---

#### 9. `layout/main-layout.ts`

**Location:** Line 405

**Note:** Already imports `ROUTES`

**Change:**
- Replace: `'/settings'` → `` `/${ROUTES.SETTINGS}` ``

---

### Test File Updates

#### `core/auth/auth-oauth.service.spec.ts`

**Location:** Line 143

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace: `'/dashboard'` → `ROUTES.DASHBOARD`

---

#### `core/auth/has-budget.guard.spec.ts`

**Locations:** Lines ~79, ~122

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace: `['/complete-profile']` → `['/', ROUTES.COMPLETE_PROFILE]`

---

#### `core/demo/demo-initializer.service.spec.ts`

**Locations:** Lines ~108, ~337

**Change:**
- Add import: `import { ROUTES } from '@core/routing/routes-constants';`
- Replace: `['/dashboard']` → `['/', ROUTES.DASHBOARD]`

---

### Acceptance Criteria Mapping

- [x] AC1: Satisfied by `app.routes.ts` - add default redirect
- [ ] AC2: Satisfied by all 8 source files + 3 test files
- [ ] AC3: Run `pnpm test` in frontend
- [ ] AC4: Run `pnpm quality` to verify

---

### Risks & Considerations

- **Low risk**: These are simple string replacements
- **Test impact**: Test expectations must match new route usage
- **No behavioral change**: Routes still point to same destinations

---

## Step Complete

**Status:** ✓ Complete
**Files planned:** 9 source files + 3 test files = 12 files
**Tests planned:** 3 test file updates
**Next:** step-03-execute.md
**Timestamp:** 2026-01-19T12:04:00Z
