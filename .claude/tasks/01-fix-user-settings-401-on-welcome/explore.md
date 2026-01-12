# Task: Fix 401 error on /onboarding/welcome page

## Problem Summary

A 401 Unauthorized error occurs when accessing the welcome/onboarding page (`/onboarding/welcome`) because the `UserSettingsApi` makes an authenticated API call (`/api/v1/users/settings`) even when the user is not logged in.

## Root Cause

The bug was introduced in commit `5d5fe0d2f feat: add custom budget period start day configuration (#170)`.

### Flow Analysis

1. User navigates to `/onboarding/welcome`
2. `onboarding.routes.ts:11` provisions `OnboardingStore` as a route-level provider
3. `OnboardingStore` constructor injects `UserSettingsApi` (`onboarding-store.ts:60`)
4. `UserSettingsApi` is a singleton (`providedIn: 'root'`) at `user-settings-api.ts:20-22`
5. `UserSettingsApi` creates a `resource()` at line 36-39:
   ```typescript
   readonly #settingsResource = resource<UserSettings, number>({
     params: () => this.#reloadTrigger(),  // Returns 0 immediately
     loader: async () => this.#loadSettings(),
   });
   ```
6. Angular's `resource()` API triggers the loader immediately when `params()` returns a truthy value (and `0` is valid)
7. `#loadSettings()` calls the API without checking authentication
8. Result: 401 Unauthorized

### Why This Wasn't Caught

- The `OnboardingStore` only uses `UserSettingsApi.updateSettings()` (line 208) during registration
- The `UserSettingsApi` was never intended to be injected during onboarding before the user is authenticated
- The `resource()` API auto-loads data on instantiation, which was unexpected

---

## Architecture Analysis: Design Pattern Issues

### Issue 1: Core Service with Side-Effect on Instantiation (CRITICAL)

**Violation**: A `core/` service should NEVER trigger side-effects (API calls) during instantiation.

```typescript
// user-settings-api.ts:36-39 - BAD PATTERN
readonly #settingsResource = resource<UserSettings, number>({
  params: () => this.#reloadTrigger(),  // Returns 0 immediately → triggers loader
  loader: async () => this.#loadSettings(),
});
```

**Rule**: Core services must be **inert** until an explicit action is called. A service that makes API calls on injection is unpredictable and creates hidden coupling.

**Impact**: Any component/service that injects `UserSettingsApi` will trigger an API call, even if it only needs `updateSettings()`.

### Issue 2: Authenticated Service without Auth Guard (CRITICAL)

**Violation**: `UserSettingsApi` calls an authenticated endpoint (`/users/settings`) without checking authentication state.

```typescript
// No auth check before calling authenticated endpoint
async #loadSettings(): Promise<UserSettings> {
  return await firstValueFrom(this.#httpClient.get(...)); // → 401 if not logged in
}
```

**Rule**: A service that depends on authentication MUST either:
1. Inject `AuthApi` and check state before calling
2. Be placed in a context where auth is guaranteed (route guard)

### Issue 3: Premature Injection in OnboardingStore (MODERATE)

**Violation**: `OnboardingStore` injects `UserSettingsApi` as a class dependency, but only uses it in a late method (`submitRegistration`).

```typescript
// onboarding-store.ts:60
readonly #userSettingsApi = inject(UserSettingsApi);  // Injected at construction

// ONLY used in submitRegistration (line 208), after user is authenticated
await this.#userSettingsApi.updateSettings({...});
```

**Rule**: Don't inject expensive dependencies that aren't immediately needed, especially if they have side-effects.

### Dependency Graph Analysis

```
OnboardingStore (feature/onboarding)
    └── injects UserSettingsApi (core/user-settings) ← Correct direction
            └── resource() auto-triggers loader ← Side-effect on injection!
                    └── GET /users/settings ← No auth check!
```

**The design violates two core principles:**
1. **Inert Services**: Core services should be passive until activated
2. **Auth Awareness**: Authenticated endpoints need auth guards

## Key Files

| File | Line | Purpose |
|------|------|---------|
| `frontend/projects/webapp/src/app/core/user-settings/user-settings-api.ts` | 36-39 | Resource that triggers API call on instantiation |
| `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts` | 60 | Injects UserSettingsApi (triggers instantiation) |
| `frontend/projects/webapp/src/app/feature/onboarding/onboarding.routes.ts` | 11 | Provisions OnboardingStore for all onboarding routes |

## Solution Options

### Option A: Auth-Aware Resource (Recommended)

Modify `UserSettingsApi` to only load settings when authenticated. This follows the **"auth-aware service"** pattern.

```typescript
readonly #authApi = inject(AuthApi);

readonly #settingsResource = resource<UserSettings | null, { trigger: number; isAuthenticated: boolean }>({
  params: () => ({
    trigger: this.#reloadTrigger(),
    isAuthenticated: !!this.#authApi.authState().user,
  }),
  loader: async ({ params }) => {
    if (!params.isAuthenticated) {
      return null; // Skip loading when not authenticated
    }
    return this.#loadSettings();
  },
});
```

**Architecture Benefits:**
- Fixes Issue #2 (auth awareness) directly
- Service becomes self-protecting
- No changes needed in consumers
- Follows "fail-safe" principle

**Trade-off:**
- Adds `AuthApi` as dependency (acceptable for authenticated services)

### Option B: Explicit Initialization Pattern (Alternative)

Disable auto-loading by making `params` return `undefined` initially. Consumers must call `initialize()`.

```typescript
readonly #isInitialized = signal(false);

readonly #settingsResource = resource<UserSettings, number | undefined>({
  params: () => this.#isInitialized() ? this.#reloadTrigger() : undefined,
  loader: async () => this.#loadSettings(),
});

initialize(): void {
  this.#isInitialized.set(true);
}
```

**Architecture Benefits:**
- Fixes Issue #1 (inert services) directly
- No auth dependency
- Explicit control

**Trade-offs:**
- All consumers must call `initialize()`
- Easy to forget → potential bugs
- Doesn't fix Issue #2 (still no auth check)

### Option C: Injector Pattern in OnboardingStore (Not Recommended)

Use Angular's `Injector` to get `UserSettingsApi` lazily only when needed.

```typescript
readonly #injector = inject(Injector);

async submitRegistration(...) {
  // Get service only when needed
  const userSettingsApi = this.#injector.get(UserSettingsApi);
  await userSettingsApi.updateSettings({...});
}
```

**Trade-offs:**
- Hides dependencies
- Violates explicit injection principle
- Doesn't fix the root cause in `UserSettingsApi`
- **NOT RECOMMENDED**: Masks the real problem

---

## Recommended Fix: Option A (Auth-Aware Resource)

**Option A** is the correct architectural solution because:

| Principle | How Option A Addresses It |
|-----------|---------------------------|
| **Inert Services** | Resource only loads when auth condition is met |
| **Auth Awareness** | Service checks auth before API calls |
| **Self-Protecting** | Service cannot be misused by unauthenticated contexts |
| **No Consumer Changes** | Existing consumers continue to work |
| **Fail-Safe** | Returns `null` instead of throwing 401 |

This transforms `UserSettingsApi` from an **"eager, unsafe"** service to an **"auth-aware, lazy"** service.

## Dependencies

- `AuthApi` must be available in root injector (it already is)

## Testing Considerations

1. Unit test: `UserSettingsApi` should not call API when user is not authenticated
2. E2E test: Onboarding flow should work without console errors
3. Regression test: Authenticated users should still load settings correctly
