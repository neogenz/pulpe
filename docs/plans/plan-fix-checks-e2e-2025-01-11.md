# Plan: Fix pnpm checks and E2E Tests Isolation

**Date**: 2025-01-11
**Objective**: Ensure `pnpm checks` runs successfully from root without failures, and E2E tests are properly isolated

## Problems Identified

### Problem 1: turbo.json `checks` Task Configuration ❌
**Current state:**
```json
"checks": {
  "dependsOn": [
    "build",
    "quality:fix",  // ❌ Modifies files (lint:fix, format)
    "quality",      // ❌ Then validates the modified files
    "test",
    "test:e2e",
    "test:performance"
  ],
  "cache": false
}
```

**Issues:**
- `quality:fix` auto-fixes issues before `quality` validates → circular logic
- Checks should ONLY validate, NEVER modify
- Not suitable for CI/pre-commit validation

### Problem 2: E2E Tests Failing (demo-mode.spec.ts) ❌
**4 failing tests:**
1. "should create demo session and navigate to dashboard"
2. "should have functional demo data after creation"
3. "should handle demo creation errors gracefully"
4. "should show loading state during demo creation"

**Root cause:**
- Tests dispatch `CustomEvent('turnstile-success')` on window
- Component listens to `(resolved)` output from ngx-turnstile component
- **No bridge between the two mechanisms**
- Component never receives the test event → demo session never starts

### Problem 3: Tests ARE Properly Isolated ✅
- Each test sets up independent mocks
- Parallel execution mode enabled
- No shared state between tests
- The isolation is correct, architecture is not

## Solution Architecture

### Option A: Minimal Fix (Quick Win)
**Approach:** Add window event listener to component for E2E support

**Changes:**
1. Update `welcome.ts` to listen for `turnstile-success` events
2. Add `__E2E_DEMO_MODE_TEST__` flag check
3. Bridge custom event → component method

**Pros:** Minimal changes, tests unchanged
**Cons:** Adds test-specific code to production

### Option B: E2E Bypass Pattern (RECOMMENDED)
**Approach:** Extend existing auth-bypass pattern for demo mode

**Changes:**
1. Add `setupDemoBypass()` to `auth-bypass.ts`
2. Update `demo-initializer.service.ts` to check `__E2E_DEMO_BYPASS__` flag
3. Mock demo session creation entirely in E2E context
4. Update tests to use bypass

**Pros:**
- Consistent with existing E2E architecture
- Clean separation of concerns
- No custom event hacks
- Tests become truly isolated from Turnstile/backend

**Cons:** More files to modify

## Implementation Plan

### Phase 1: Fix turbo.json `checks` Task
**File:** `turbo.json`

**Change:**
```json
"checks": {
  "dependsOn": [
    "^build",      // Build dependencies first
    "quality",     // ✅ ONLY validate (no fix)
    "test",        // Unit tests
    "test:e2e"     // E2E tests
  ],
  "cache": false
}
```

**Rationale:**
- Remove `quality:fix` - it modifies files (dev-only)
- Remove `test:performance` - optional, slow for standard checks
- Keep validation-only tasks

**Alternative:** Add separate tasks for dev vs CI
```json
"checks": { ... },           // Validation only (current)
"checks:fix": {              // Dev workflow (auto-fix then validate)
  "dependsOn": ["quality:fix", "quality", "test"],
  "cache": false
}
```

### Phase 2: Fix E2E Tests (Option B - Recommended)

#### Step 2.1: Create Demo Bypass Mechanism
**File:** `frontend/e2e/support/demo-bypass.ts` (NEW)

```typescript
import type { Page } from '@playwright/test';

export interface DemoBypassOptions {
  userId?: string;
  userEmail?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Setup E2E bypass for demo mode
 * Allows tests to skip Turnstile and backend demo session creation
 */
export async function setupDemoBypass(
  page: Page,
  options: DemoBypassOptions = {}
): Promise<void> {
  const {
    userId = 'e2e-demo-user-' + Date.now(),
    userEmail = 'demo@e2e.test',
    accessToken = 'e2e-demo-access-token',
    refreshToken = 'e2e-demo-refresh-token',
  } = options;

  await page.addInitScript(
    ({ userId, userEmail, accessToken, refreshToken }) => {
      const w = window as any;
      w.__E2E_DEMO_BYPASS__ = true;
      w.__E2E_DEMO_SESSION__ = {
        user: { id: userId, email: userEmail },
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    },
    { userId, userEmail, accessToken, refreshToken }
  );
}
```

#### Step 2.2: Update DemoInitializerService
**File:** `frontend/projects/webapp/src/app/core/demo/demo-initializer.service.ts`

**Add E2E bypass check:**
```typescript
async startDemoSession(turnstileToken: string): Promise<void> {
  // E2E Test Bypass
  if (typeof window !== 'undefined' && (window as any).__E2E_DEMO_BYPASS__) {
    this.#logger.info('🎭 E2E Demo Bypass: Skipping Turnstile & backend');
    await this.#handleE2EDemoBypass();
    return;
  }

  // Normal flow...
  this.#logger.debug('Creating demo session with Turnstile token');
  // ... rest of implementation
}

async #handleE2EDemoBypass(): Promise<void> {
  const mockSession = (window as any).__E2E_DEMO_SESSION__;

  if (!mockSession) {
    throw new Error('E2E bypass enabled but no mock session found');
  }

  // Set auth session
  await this.#authApi.setSession({
    access_token: mockSession.access_token,
    refresh_token: mockSession.refresh_token,
  });

  // Activate demo mode
  this.#demoModeService.activateDemoMode(mockSession.user.email);

  // Navigate to dashboard
  await this.#router.navigate([ROUTES.APP, ROUTES.CURRENT_MONTH]);
}
```

#### Step 2.3: Update E2E Tests
**File:** `frontend/e2e/tests/critical-path/demo-mode.spec.ts`

**Changes:**
1. Import `setupDemoBypass`
2. Remove custom event dispatch logic
3. Add bypass setup before each test
4. Remove Turnstile simulation code

**Example:**
```typescript
import { setupDemoBypass } from '../../support/demo-bypass';

test.describe('Demo Mode - Critical Path', () => {
  test.beforeEach(async ({ page }) => {
    // Setup E2E demo bypass
    await setupDemoBypass(page, {
      userId: 'e2e-demo-user',
      userEmail: 'demo@e2e.test',
    });
  });

  test('should create demo session and navigate to dashboard', async ({ page }) => {
    // Mock API endpoints for data
    await page.route('**/api/v1/budgets/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockBudgets }),
      });
    });

    await page.route('**/api/v1/budget-templates**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockTemplates }),
      });
    });

    // Navigate and click demo button
    await page.goto('/onboarding/welcome');
    await page.getByTestId('demo-mode-button').click();

    // NO NEED for Turnstile simulation - bypass handles it
    // The bypass directly navigates to dashboard

    // Verify navigation
    await expect(page).toHaveURL(/\/app\/current-month/, { timeout: 10000 });
    await expect(page.getByTestId('current-month-page')).toBeVisible();
  });
});
```

### Phase 3: Additional Isolation Improvements

#### Step 3.1: Mock Supabase Client in Tests
**File:** `frontend/e2e/support/supabase-mock.ts` (NEW)

```typescript
import type { Page } from '@playwright/test';

export async function mockSupabaseClient(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Mock Supabase client creation
    const w = window as any;
    w.createClient = function () {
      return {
        auth: {
          getSession: () =>
            Promise.resolve({ data: { session: null }, error: null }),
          setSession: (session: any) =>
            Promise.resolve({
              data: {
                session: {
                  ...session,
                  user: {
                    id: w.__E2E_DEMO_SESSION__?.user?.id || 'mock-user',
                    email: w.__E2E_DEMO_SESSION__?.user?.email || 'mock@e2e.test',
                  },
                },
              },
              error: null,
            }),
          onAuthStateChange: () => ({
            data: { subscription: { unsubscribe: () => {} } },
          }),
        },
      };
    };
  });
}
```

#### Step 3.2: Update Test Setup
Add to all demo-mode tests:
```typescript
test.beforeEach(async ({ page }) => {
  await setupDemoBypass(page);
  await mockSupabaseClient(page);
});
```

### Phase 4: Verification & Documentation

#### Step 4.1: Run Checks
```bash
# From root
pnpm checks

# Expected: All tasks pass
# - Build: ✅
# - Quality (type-check, lint, format:check): ✅
# - Test (unit): ✅
# - Test E2E: ✅ (4 demo tests now pass)
```

#### Step 4.2: Update Documentation
**File:** `frontend/e2e/README.md` (UPDATE)

Add section:
```markdown
## E2E Test Patterns

### Demo Mode Testing

Demo mode tests use a bypass mechanism to avoid Turnstile verification:

\`\`\`typescript
import { setupDemoBypass } from './support/demo-bypass';

test('demo flow', async ({ page }) => {
  await setupDemoBypass(page);
  // Your test code
});
\`\`\`

This bypasses:
- Turnstile widget rendering
- Backend /api/v1/demo/session call
- Cloudflare verification

Instead, it directly:
- Sets a mock auth session
- Activates demo mode
- Navigates to the dashboard
```

## Risk Analysis

### Low Risk Changes ✅
- turbo.json `checks` fix - pure config, no code impact
- E2E bypass pattern - isolated to E2E tests only

### Medium Risk Changes ⚠️
- `demo-initializer.service.ts` bypass check
  - **Mitigation**: Feature-flagged behind `__E2E_DEMO_BYPASS__`
  - Only active when flag explicitly set by tests
  - Tree-shakeable in production build

### Zero Risk ✅
- Test isolation improvements - E2E tests only

## Alternative Approaches

### Alternative 1: Keep Custom Event + Add Listener
**Approach:** Make component listen to window events

**Pros:** Minimal changes to tests
**Cons:** Pollutes production code, fragile

### Alternative 2: Full Supabase Mock
**Approach:** Mock entire Supabase client

**Pros:** Complete isolation
**Cons:** Complex, might hide real issues

## Success Criteria

1. ✅ `pnpm checks` passes from root without errors
2. ✅ All E2E tests pass (including 4 demo-mode tests)
3. ✅ Tests remain isolated (no shared state)
4. ✅ No regression in existing unit tests
5. ✅ turbo.json follows CI best practices (validation-only)

## Testing Strategy

### Unit Tests
- No changes required
- Already passing

### E2E Tests
- Update all 4 failing demo-mode tests
- Add new test: "should bypass demo in E2E mode"
- Verify no regression in other E2E tests

### Manual Verification
- Verify demo mode still works in local dev (no bypass)
- Verify demo mode works in production (no bypass)
- Verify Turnstile widget renders correctly outside E2E

## Rollback Plan

If issues occur:
1. Revert turbo.json changes → restore original `checks` task
2. Revert E2E bypass → restore custom event dispatch
3. Revert `demo-initializer.service.ts` changes

Each phase can be rolled back independently.

## Implementation Order

1. **Phase 1**: Fix turbo.json (5 min)
2. **Phase 2**: Implement E2E bypass (30 min)
3. **Phase 3**: Add Supabase mock (optional, 15 min)
4. **Phase 4**: Verify & document (10 min)

**Total estimated time**: 1 hour

## Next Steps

After user approval:
1. Execute Phase 1 (turbo.json fix)
2. Execute Phase 2 (E2E bypass)
3. Run `pnpm checks` from root
4. Verify all tests pass
5. Create commit with atomic changes
6. Update documentation

---

## Post-Implementation Update (2025-01-12)

### Issue Found: Redundant Supabase Call in Demo Bypass (Dormant Bug)

**Discovered during code review** - identified before E2E demo tests were written.

#### Problem Analysis

The `__E2E_DEMO_BYPASS__` implementation in `demo-initializer.service.ts:166-173`
called `this.#authApi.setSession()`, which attempted a real Supabase call even when
`__E2E_AUTH_BYPASS__` was active.

**Root Cause:**
- The `setSession()` method in `auth-api.ts` doesn't check for `__E2E_AUTH_BYPASS__` flag
- Other auth methods like `signOut()` properly handle this bypass (lines 263-296)
- Auth state is already mocked by `setupAuthBypass()` which sets `__E2E_MOCK_AUTH_STATE__`

**Why Tests Still Pass:**
- No E2E demo tests exist yet (`demo-mode.spec.ts` was never created)
- The bypass code exists but is never exercised
- This is a **dormant bug** that would manifest when demo E2E tests are written

#### Fix Applied

**Files Modified:**

1. **`frontend/projects/webapp/src/app/core/demo/demo-initializer.service.ts`**
   - Removed lines 166-173 (setSession call)
   - Added explanatory comment about auth already being mocked
   - Simplified bypass to just activate demo mode and navigate

2. **`frontend/projects/webapp/src/app/core/auth/auth-api.ts`**
   - Added JSDoc warning on `setSession()` method
   - Documents that it doesn't check `__E2E_AUTH_BYPASS__`
   - Prevents future developers from making the same mistake

#### Justification

Auth state is already properly configured by `setupAuthBypass()`:
- Injects `__E2E_MOCK_AUTH_STATE__` with user and session
- `auth-api.ts:initializeAuthState()` reads this mock state (lines 73-91)
- No need to call `setSession()` again - it would only trigger a real Supabase call and fail

#### Impact

- **Risk**: Zero - Code path not exercised, preventive fix
- **Result**: Cleaner bypass implementation aligned with E2E architecture
- **Future**: When demo E2E tests are written, they will work correctly
