# Implementation Plan: Move E2EWindow to Testing Domain

## Overview

Reorganize E2E testing utilities by moving `E2EWindow` from `core/auth/` to `core/testing/`. This improves separation of concerns by placing test-specific code in the testing domain rather than the auth domain.

**Approach:** Option 2 Améliorée (recommended by exploration)
- Move `E2EWindow` interface to `core/testing/`
- Create centralized `isE2EMode()` helper function
- Update all imports across the codebase
- Consolidate duplicated E2E type definitions
- Maintain production safety (no bundled test code)

**Estimated effort:** 1-2 hours

## Dependencies

None - this is a pure refactoring with no external dependencies.

## File Changes

### `frontend/projects/webapp/src/app/core/testing/e2e-window.ts` (CREATE)

- Create new file with E2EWindow interface (moved from `core/auth/e2e-window.ts`)
- Import `AuthState` type from `@core/auth` (preserve existing dependency)
- Define complete `E2EWindow` interface extending `Window` with:
  - `__E2E_AUTH_BYPASS__?: boolean` - Flag to bypass authentication flows
  - `__E2E_MOCK_AUTH_STATE__?: AuthState` - Mock auth state for tests
  - `__E2E_DEMO_BYPASS__?: boolean` - Flag to bypass demo session Turnstile
  - `__E2E_DEMO_SESSION__?: DemoSession` - Mock demo session data
- Add `DemoSession` interface with:
  - `user: { id: string; email: string }`
  - `access_token: string`
  - `refresh_token: string`
- Create centralized helper function `isE2EMode(): boolean`:
  - Check `typeof window !== 'undefined'`
  - Return `(window as E2EWindow).__E2E_AUTH_BYPASS__ === true`
- Add JSDoc comments explaining the purpose and usage

**Rationale:** Centralizes all E2E window detection logic in one place, making it easier to maintain and understand.

### `frontend/projects/webapp/src/app/core/testing/index.ts` (MODIFY)

- Add export statement: `export * from './e2e-window';`
- Maintain alphabetical order of exports

### `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts` (MODIFY)

**Import changes:**
- Remove: `import type { E2EWindow } from './e2e-window';`
- Add: `import { isE2EMode, type E2EWindow } from '@core/testing';`

**Method changes:**
- Line 220-225: Replace `#isE2EBypass()` method body with:
  ```typescript
  #isE2EBypass(): boolean {
    return isE2EMode();
  }
  ```
- Line 227-229: Update `#getE2EMockState()` to still cast to `E2EWindow` (imported from new location)

**Alternative:** Could remove `#isE2EBypass()` entirely and call `isE2EMode()` directly, but keeping the wrapper method maintains better encapsulation and makes future changes easier.

### `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts` (MODIFY)

**Import changes:**
- Remove: `import type { E2EWindow } from './e2e-window';`
- Add: `import { isE2EMode } from '@core/testing';`

**Method changes:**
- Line 90-95: Replace `#isE2EBypass()` method body with:
  ```typescript
  #isE2EBypass(): boolean {
    return isE2EMode();
  }
  ```

### `frontend/projects/webapp/src/app/core/auth/auth-oauth.service.ts` (MODIFY)

**Import changes:**
- Remove: `import type { E2EWindow } from './e2e-window';`
- Add: `import { isE2EMode } from '@core/testing';`

**Method changes:**
- Line 77-82: Replace `#isE2EBypass()` method body with:
  ```typescript
  #isE2EBypass(): boolean {
    return isE2EMode();
  }
  ```

### `frontend/projects/webapp/src/app/core/turnstile/turnstile.service.ts` (MODIFY)

**Import changes:**
- Add: `import { isE2EMode } from '@core/testing';` (currently has no import for E2E)

**Method changes:**
- Line 109-114: Replace `#isE2EBypass()` method body with:
  ```typescript
  #isE2EBypass(): boolean {
    return isE2EMode();
  }
  ```
- Remove inline window casting `(window as { __E2E_DEMO_BYPASS__?: boolean })` at line 50
- Use proper `E2EWindow` type instead

### `frontend/projects/webapp/src/app/core/demo/demo-initializer.service.ts` (MODIFY)

**Import changes:**
- Remove inline type: `window as { __E2E_DEMO_BYPASS__?: boolean }`
- Add: `import { type E2EWindow } from '@core/testing';`

**Code changes:**
- Line 48-54: Replace inline window cast with proper type:
  ```typescript
  if (
    typeof window !== 'undefined' &&
    (window as E2EWindow).__E2E_DEMO_BYPASS__ === true
  ) {
  ```
- Consider: Extract to helper method `#isE2EDemoBypass()` for consistency with other services

### `frontend/projects/webapp/src/app/core/auth/index.ts` (MODIFY)

- Line 14: Remove export statement: `export * from './e2e-window';`
- E2E types will now be exported from `@core/testing` instead

### `frontend/e2e/types/e2e.types.ts` (MODIFY)

**Consolidate type definitions:**
- Remove duplicate `E2EWindow` interface (lines 16-44)
- Remove duplicate `OAuthUserMetadata` interface (lines 9-14)
- Add import: `import { type E2EWindow } from '../../projects/webapp/src/app/core/testing';`
- Keep remaining types:
  - `RouteHandler`
  - `RequestHandler`
  - `ErrorHandler`
  - `MockApiResponse`
  - `TestCredentials`

**Rationale:** Eliminates duplication between E2E test types and application types. The E2E tests should import from the application's testing utilities rather than defining their own version.

### Spec files (MODIFY)

Update imports in all test files:

**`frontend/projects/webapp/src/app/core/auth/auth-session.service.spec.ts`**
- Change: `import type { E2EWindow } from './e2e-window';`
- To: `import { type E2EWindow } from '@core/testing';`

**`frontend/projects/webapp/src/app/core/auth/auth-credentials.service.spec.ts`**
- Change: `import type { E2EWindow } from './e2e-window';`
- To: `import { type E2EWindow } from '@core/testing';`

**`frontend/projects/webapp/src/app/core/auth/auth-oauth.service.spec.ts`**
- Change: `import type { E2EWindow } from './e2e-window';`
- To: `import { type E2EWindow } from '@core/testing';`

**`frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.spec.ts`**
- Change: `import type { E2EWindow } from './e2e-window';`
- To: `import { type E2EWindow } from '@core/testing';`

### `frontend/projects/webapp/src/app/core/auth/e2e-window.ts` (DELETE)

- Remove entire file after all imports have been updated
- Content has been moved to `core/testing/e2e-window.ts`

## Testing Strategy

### Unit Tests to Verify

**No new tests needed**, but verify existing tests still pass:

```bash
cd frontend
pnpm test -- projects/webapp/src/app/core/auth/auth-session.service.spec.ts
pnpm test -- projects/webapp/src/app/core/auth/auth-credentials.service.spec.ts
pnpm test -- projects/webapp/src/app/core/auth/auth-oauth.service.spec.ts
pnpm test -- projects/webapp/src/app/core/auth/auth-cleanup.service.spec.ts
```

### E2E Tests to Verify

Run full E2E suite to ensure auth bypass still works:

```bash
cd frontend
pnpm test:e2e
```

**Critical E2E tests:**
- `e2e/tests/auth/login.spec.ts` - Verify `setupAuthBypass()` works
- `e2e/tests/dashboard/dashboard.spec.ts` - Verify authenticated flows
- `e2e/tests/demo/demo-session.spec.ts` - Verify demo bypass works

### Manual Verification

1. Run app in development mode: `pnpm dev`
2. Verify no console errors
3. Verify login flow works normally (not bypassed)
4. Run E2E test with auth bypass and verify it works

### Type Checking

```bash
cd frontend
pnpm run type-check
```

Ensure no TypeScript errors related to E2EWindow imports.

## Documentation

No documentation updates needed:
- This is an internal refactoring
- E2E testing setup remains unchanged
- External API unchanged (just import path changes)

## Rollout Considerations

### Production Safety

- ✅ No production impact - E2E code is never bundled in production builds
- ✅ Window properties only exist during E2E tests (set via Playwright's `page.addInitScript()`)
- ✅ Runtime checks ensure window properties are never accessed in production

### Breaking Changes

None - this is an internal refactoring with no external API changes.

### Migration Steps

1. Create new `core/testing/e2e-window.ts` file
2. Update `core/testing/index.ts` to export new module
3. Update all service imports (auth, turnstile, demo)
4. Update all spec file imports
5. Update `core/auth/index.ts` to remove old export
6. Consolidate `e2e/types/e2e.types.ts`
7. Delete old `core/auth/e2e-window.ts`
8. Run tests to verify
9. Run `pnpm quality` before commit

### Risks & Mitigation

**Risk:** Circular dependency between `core/testing` and `core/auth`
- **Current:** `core/testing/e2e-window.ts` imports `AuthState` from `core/auth`
- **Mitigation:** This is acceptable - `testing` domain can depend on `auth` domain
- **Note:** The dependency is type-only (`import type`), not runtime

**Risk:** Missing import updates causing build failures
- **Mitigation:** TypeScript will catch all missing imports at build time
- **Verification:** Run `pnpm run type-check` after changes

**Risk:** E2E tests failing due to incorrect window property access
- **Mitigation:** Run full E2E suite after changes
- **Verification:** All existing E2E tests should pass without modification

## Implementation Order

Follow this strict order to avoid breaking changes:

1. **CREATE** `core/testing/e2e-window.ts` (new file with all types and helper)
2. **MODIFY** `core/testing/index.ts` (export new module)
3. **MODIFY** service files in parallel:
   - `auth-session.service.ts`
   - `auth-credentials.service.ts`
   - `auth-oauth.service.ts`
   - `turnstile.service.ts`
   - `demo-initializer.service.ts`
4. **MODIFY** spec files in parallel:
   - `auth-session.service.spec.ts`
   - `auth-credentials.service.spec.ts`
   - `auth-oauth.service.spec.ts`
   - `auth-cleanup.service.spec.ts`
5. **MODIFY** `core/auth/index.ts` (remove export)
6. **MODIFY** `e2e/types/e2e.types.ts` (consolidate types)
7. **DELETE** `core/auth/e2e-window.ts` (old file)
8. **VERIFY** tests and type checking
9. **RUN** `pnpm quality` before commit

## Success Criteria

- ✅ All unit tests pass
- ✅ All E2E tests pass
- ✅ No TypeScript errors
- ✅ `pnpm quality` passes
- ✅ No runtime errors in development mode
- ✅ Auth bypass works correctly in E2E tests
- ✅ Demo bypass works correctly in E2E tests
- ✅ Old `core/auth/e2e-window.ts` file is deleted
- ✅ All imports updated to use `@core/testing`

## Notes

- This refactoring improves code organization without changing functionality
- The E2E window pattern remains the same (recommended by exploration)
- Future improvements could include extracting `#isE2EBypass()` methods to use `isE2EMode()` directly
- Consider creating additional helpers like `getE2EMockAuthState()` and `getE2EDemoSession()` if needed
