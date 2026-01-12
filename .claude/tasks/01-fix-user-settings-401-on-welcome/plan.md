# Implementation Plan: Fix 401 Error on /onboarding/welcome

## Overview

Modify `UserSettingsApi` to become an **auth-aware service** that only loads settings when the user is authenticated. This prevents the 401 error that occurs when `OnboardingStore` injects `UserSettingsApi` on the welcome page (before authentication).

**Strategy**: Use Angular's `resource()` API with a conditional `params()` function that checks `AuthApi.isAuthenticated()`. When not authenticated, return `null` from the loader without making an API call.

## Dependencies

- `AuthApi` must be available (it is - `providedIn: 'root'`)
- No circular dependency exists (`AuthApi` does not import `UserSettingsApi`)

## File Changes

### `frontend/projects/webapp/src/app/core/user-settings/user-settings-api.ts`

**1. Add AuthApi injection**
- Import `AuthApi` from `../auth/auth-api`
- Add private field: `readonly #authApi = inject(AuthApi);`

**2. Modify resource type signature**
- Change from `resource<UserSettings, number>` to `resource<UserSettings | null, { isAuthenticated: boolean }>`
- The `number` param (reloadTrigger) will be moved inside the params object

**3. Modify params() function**
- Return object with `isAuthenticated` derived from `this.#authApi.isAuthenticated()`
- Include `reloadTrigger` in the params object for manual reload capability
- Pattern: `params: () => ({ isAuthenticated: this.#authApi.isAuthenticated(), trigger: this.#reloadTrigger() })`

**4. Modify loader() function**
- Add early return: if `!params.isAuthenticated`, return `null` (no API call)
- Only call `#loadSettings()` when authenticated
- Pattern: `loader: async ({ params }) => params.isAuthenticated ? this.#loadSettings() : null`

**5. Update computed signals for null handling**
- `settings` computed: no change needed (already returns `value()` which can be `undefined`)
- `payDayOfMonth` computed: already handles null with `?? null`
- `isLoading` computed: no change needed
- `error` computed: no change needed

**6. Consider: No changes to `updateSettings()` or `reload()`**
- `updateSettings()` is called after authentication (in `submitRegistration`)
- `reload()` just increments trigger - the loader will check auth state

### `frontend/projects/webapp/src/app/core/user-settings/user-settings-api.spec.ts` (NEW FILE)

**1. Create test file with Vitest setup**
- Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`
- Import `TestBed` from `@angular/core/testing`
- Import `UserSettingsApi` and `AuthApi`
- Import `HttpClientTestingModule` and `HttpTestingController`

**2. Create mock AuthApi**
- Use `signal` to create controllable `isAuthenticated` state
- Pattern: `{ isAuthenticated: signal(false).asReadonly() }`

**3. Test: should NOT call API when not authenticated**
- Arrange: Mock `AuthApi.isAuthenticated()` to return `false`
- Act: Inject `UserSettingsApi` (triggers resource)
- Assert: `httpTestingController.expectNone()` - no HTTP request made
- Assert: `service.settings()` is `null` or `undefined`

**4. Test: should call API when authenticated**
- Arrange: Mock `AuthApi.isAuthenticated()` to return `true`
- Act: Inject `UserSettingsApi`
- Assert: `httpTestingController.expectOne()` with correct URL
- Assert: Respond with mock data, verify `service.settings()` matches

**5. Test: should load settings when user becomes authenticated**
- Arrange: Start with `isAuthenticated: false`
- Act: Change mock to `isAuthenticated: true`, trigger change detection
- Assert: HTTP request is made after auth state changes

**6. Test: updateSettings should work when authenticated**
- Arrange: Mock authenticated state
- Act: Call `updateSettings({ payDayOfMonth: 15 })`
- Assert: PUT request made, response handled correctly

## Testing Strategy

**Unit Tests** (in `user-settings-api.spec.ts`):
- Resource does not trigger API when not authenticated
- Resource triggers API when authenticated
- Resource reacts to authentication changes
- `updateSettings()` works correctly
- `reload()` triggers new request when authenticated

**Manual Verification**:
1. Navigate to `/onboarding/welcome` without being logged in
2. Open browser DevTools → Network tab
3. Verify NO request to `/api/v1/users/settings`
4. Verify NO 401 error in console
5. Complete registration/login
6. Verify settings are loaded after authentication

**E2E Test** (optional, if time permits):
- Existing onboarding E2E tests should pass without 401 errors

## Documentation

No documentation updates needed - this is an internal implementation fix.

## Rollout Considerations

**Breaking Changes**: None
- The public API (`settings`, `payDayOfMonth`, `isLoading`, `error`, `updateSettings`, `reload`) remains unchanged
- Consumers already handle `null`/`undefined` settings

**Backward Compatibility**: Full
- Existing features that use `UserSettingsApi` after authentication will continue to work
- The resource will automatically load when authentication succeeds

**Risk**: Low
- The fix is isolated to one file
- Type signature change is internal
- All existing consumers handle nullable settings
