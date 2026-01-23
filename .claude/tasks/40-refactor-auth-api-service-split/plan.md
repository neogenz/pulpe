# Implementation Plan: Refactor Auth-API Service Split

## Overview

Refactor the 475-line `auth-api.ts` service into 6 focused, single-responsibility services following clean code principles (≤300 lines per file). The refactored `auth-api.ts` will become a facade that delegates to specialized services, maintaining backward compatibility for 24 consumer files.

**Strategy**: Create services bottom-up (state → session → methods → cleanup), then refactor auth-api.ts to delegate. No breaking changes for consumers.

**Key Decision**: Remove budget pre-loading from auth services (BudgetApi injection) per exploration recommendation. Guards already handle cache miss gracefully.

## Dependencies

**Implementation Order** (respect dependency chain):
1. AuthStateService (no deps) → create first
2. AuthSessionService (depends on AuthStateService) → create second
3. AuthCredentialsService, AuthOAuthService, AuthDemoService (depend on AuthStateService + AuthSessionService) → create third
4. AuthCleanupService (depends on all above + external services) → create fourth
5. AuthApi facade (depends on all above) → refactor last

**External Services Used**:
- DemoModeService, HasBudgetCache, PostHogService, StorageService, Logger
- Supabase client (@supabase/supabase-js)
- ApplicationConfiguration, AuthErrorLocalizer

**⚠️ Breaking Change Avoided**: Removing BudgetApi injection from auth means guards must handle cache miss (already implemented in has-budget.guard.ts).

---

## File Changes

### Phase 1: Core State Service (No Dependencies)

#### `frontend/projects/webapp/src/app/core/auth/auth-state.service.ts` (NEW)
- Create @Injectable({ providedIn: 'root' }) service
- Extract private signals from auth-api.ts:57-59:
  - `#sessionSignal = signal<Session | null>(null)`
  - `#isLoadingSignal = signal(true)`
  - `#userSignal = computed(() => this.#sessionSignal()?.user ?? null)`
- Extract public readonly signals from auth-api.ts:67-81:
  - `session`, `isLoading`, `user`, `isAuthenticated`, `authState`
- Convert auth-api.ts:#updateAuthState (lines 215-218) to public methods:
  - `setSession(session: Session | null): void` - updates #sessionSignal
  - `setLoading(loading: boolean): void` - updates #isLoadingSignal
- Export AuthState interface at bottom (from auth-api.ts:61-66)
- Pattern: Follow DemoModeService (76 lines) - private signals with readonly exposure
- Consider: Pure state service, no side effects, no injected dependencies

#### `frontend/projects/webapp/src/app/core/auth/auth-state.service.spec.ts` (NEW)
- Test signal initialization: session=null, isLoading=true
- Test setSession() mutation updates both session and computed user
- Test setLoading() mutation
- Test computed authState aggregates all signals correctly
- Test isAuthenticated() returns true when session exists, false otherwise
- Pattern: AAA structure (Arrange/Act/Assert), descriptive test names

---

### Phase 2: Session Management Service

#### `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts` (NEW)
- Create @Injectable({ providedIn: 'root' }) service
- Inject: AuthStateService, ApplicationConfiguration, Logger
- Extract #supabaseClient field from auth-api.ts:54-56
- Add public getClient() method: Returns #supabaseClient or throws if not initialized
- Extract initializeAuthState() from auth-api.ts:108-190:
  - E2E bypass logic (calls #isE2EBypass, #getE2EMockState)
  - Supabase client creation with createClient()
  - Initial session load with getSession()
  - Auth state change listener (onAuthStateChange callback)
  - Replace this.#updateAuthState() calls with this.#state.setSession()
  - Replace this.#isLoadingSignal.set() with this.#state.setLoading()
- Extract E2E helper methods from auth-api.ts:122-135, 200-213:
  - `#isE2EBypass(): boolean` - checks window.__E2E_AUTH_BYPASS__
  - `#getE2EMockState(): AuthState` - reads window.__E2E_MOCK_AUTH_STATE__
  - `#setE2EMockState(state: AuthState): void` - writes to window property
- Extract getCurrentSession() from auth-api.ts:421-437
- Extract refreshSession() from auth-api.ts:443-466
- Pattern: Follow UserSettingsApi (146 lines) - service composition via inject()
- Consider: This service owns Supabase client lifecycle

#### `frontend/projects/webapp/src/app/core/auth/auth-session.service.spec.ts` (NEW)
- Mock createClient from @supabase/supabase-js
- Mock AuthStateService methods (setSession, setLoading)
- Test initializeAuthState() normal flow:
  - Creates Supabase client
  - Loads initial session
  - Sets up auth listener
  - Updates AuthStateService
- Test initializeAuthState() E2E bypass flow:
  - Skips Supabase initialization
  - Uses mock state from window
  - Sets loading=false immediately
- Test getCurrentSession() calls Supabase client correctly
- Test refreshSession() updates AuthStateService with new session
- Test auth state change listener propagates session updates
- Verify error handling and logging

---

### Phase 3: Authentication Methods (Credentials)

#### `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts` (NEW)
- Create @Injectable({ providedIn: 'root' }) service
- Inject: AuthSessionService, AuthStateService, AuthErrorLocalizer, Logger
- Extract signInWithEmail() from auth-api.ts:256-285:
  - Call this.#state.setLoading(true) before operation
  - E2E bypass check (lines 260-263): if bypass, set mock state and return success
  - Get Supabase client: this.#session.getClient()
  - Call client.auth.signInWithPassword({ email, password })
  - If error, localize with this.#errorLocalizer.localize(error)
  - Log warnings/errors with this.#logger
  - Update session: this.#state.setSession(data.session)
  - Return { success: boolean; error?: string }
  - Finally: this.#state.setLoading(false)
- Extract signUpWithEmail() from auth-api.ts:291-316:
  - Same pattern as signInWithEmail
  - E2E bypass check (lines 291-294)
  - Call client.auth.signUp({ email, password })
  - Handle email confirmation required case
- Pattern: try-catch-finally with loading state, error localization
- Consider: Preserve exact return type for backward compatibility

#### `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.spec.ts` (NEW)
- Mock AuthSessionService.getClient() to return mock Supabase client
- Mock AuthStateService (setSession, setLoading)
- Mock AuthErrorLocalizer.localize()
- Test signInWithEmail() success path:
  - Verify loading state transitions (true → false)
  - Verify session updated in AuthStateService
  - Verify returns { success: true }
- Test signInWithEmail() error path:
  - Verify error localized
  - Verify logged with context
  - Verify returns { success: false, error: 'localized message' }
- Test signUpWithEmail() success and error paths similarly
- Test E2E bypass logic for both methods
- Verify loading state always reset in finally block

---

### Phase 4: Authentication Methods (OAuth)

#### `frontend/projects/webapp/src/app/core/auth/auth-oauth.service.ts` (NEW)
- Create @Injectable({ providedIn: 'root' }) service
- Inject: AuthSessionService, AuthStateService, ApplicationConfiguration, Logger
- Extract getOAuthUserMetadata() from auth-api.ts:85-106:
  - Reads user_metadata from session.user
  - Returns { avatarUrl, fullName } or null
  - Pure helper function, no side effects
- Extract signInWithGoogle() from auth-api.ts:318-346:
  - E2E bypass check (lines 319-322)
  - Construct redirect URL with this.#applicationConfig.baseUrl
  - Call this.#session.getClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  - Handle error with localization
  - Return { success: boolean; error?: string }
- Pattern: Similar to credentials service but for OAuth flow
- Consider: OAuth redirects user away, session update happens on return

#### `frontend/projects/webapp/src/app/core/auth/auth-oauth.service.spec.ts` (NEW)
- Mock AuthSessionService.getClient()
- Mock ApplicationConfiguration.baseUrl
- Test getOAuthUserMetadata() returns correct metadata
- Test getOAuthUserMetadata() returns null when no metadata
- Test signInWithGoogle() constructs correct redirect URL
- Test signInWithGoogle() calls Supabase OAuth correctly
- Test signInWithGoogle() E2E bypass
- Test error handling and localization

---

### Phase 5: Authentication Methods (Demo Mode)

#### `frontend/projects/webapp/src/app/core/auth/auth-demo.service.ts` (NEW)
- Create @Injectable({ providedIn: 'root' }) service
- Inject: AuthSessionService, AuthStateService, Logger
- Extract setSession() from auth-api.ts:356-392:
  - Accepts session: Session | null parameter
  - Updates AuthStateService: this.#state.setSession(session)
  - Logs session injection
  - No Supabase interaction (demo mode bypasses real auth)
- Pattern: Simple state setter for demo mode integration
- Consider: Used by DemoInitializerService to inject mock sessions

#### `frontend/projects/webapp/src/app/core/auth/auth-demo.service.spec.ts` (NEW)
- Mock AuthStateService
- Test setSession() with valid session updates state
- Test setSession() with null session clears state
- Test logging occurs
- Simple service, minimal tests needed

---

### Phase 6: Cleanup Coordination

#### `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.ts` (NEW)
- Create @Injectable({ providedIn: 'root' }) service
- Inject: AuthStateService, AuthSessionService, DemoModeService, HasBudgetCache, PostHogService, StorageService, Logger
- **CRITICAL: DO NOT inject BudgetApi** (remove budget pre-loading per exploration recommendation)
- Extract signOut() from auth-api.ts:394-419:
  - E2E bypass check (lines 396-409): if bypass, set null state and return
  - Try-catch wrapper around Supabase signOut
  - Call this.#session.getClient().auth.signOut()
  - Call #handleSignOut() for cleanup coordination
  - Log errors if signOut fails
- Extract #handleSignOut() from auth-api.ts:220-236 (EXCLUDE 237-254 which is #preloadHasBudgetFlag):
  - Clear auth state: this.#state.setSession(null)
  - Clear demo mode: if (this.#demoMode.isDemoMode()) this.#demoMode.deactivateDemoMode()
  - Clear budget cache: this.#hasBudgetCache.clear()
  - Reset analytics: this.#postHog.reset()
  - Clear storage: const userId = this.#state.user()?.id; this.#storage.clearAll(userId)
  - Log completion
- **REMOVE entirely**: #preloadHasBudgetFlag() method and all BudgetApi usage
- Pattern: Orchestration service coordinates cleanup across multiple services
- Consider: Single source of truth for logout cleanup logic

#### `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.spec.ts` (NEW)
- Mock all injected services
- Test signOut() calls Supabase client.auth.signOut()
- Test signOut() calls #handleSignOut()
- Test #handleSignOut() clears auth state via AuthStateService
- Test #handleSignOut() clears demo mode when active
- Test #handleSignOut() clears HasBudgetCache
- Test #handleSignOut() resets PostHog analytics
- Test #handleSignOut() clears StorageService with userId
- Test E2E bypass in signOut
- Test error logging when signOut fails
- Verify coordination: all cleanup steps called in order

---

### Phase 7: Facade Refactoring

#### `frontend/projects/webapp/src/app/core/auth/auth-api.ts` (REFACTOR)
- **DO NOT create new file** - refactor existing file
- Keep class name `AuthApi` and file name `auth-api.ts` (consumers unchanged)
- Add JSDoc deprecation notice:
  ```typescript
  /**
   * @deprecated This facade is maintained for backward compatibility.
   * For new code, inject specific services:
   * - AuthStateService for state signals
   * - AuthCredentialsService for email/password auth
   * - AuthOAuthService for OAuth
   * - AuthCleanupService for logout
   *
   * Will be removed in v2.0
   */
  ```
- Remove all implementation code (475 lines → ~60 lines)
- Inject all 6 services:
  - `readonly #state = inject(AuthStateService);`
  - `readonly #session = inject(AuthSessionService);`
  - `readonly #credentials = inject(AuthCredentialsService);`
  - `readonly #oauth = inject(AuthOAuthService);`
  - `readonly #demo = inject(AuthDemoService);`
  - `readonly #cleanup = inject(AuthCleanupService);`
- Delegate public signals to AuthStateService:
  - `readonly session = this.#state.session;`
  - `readonly isLoading = this.#state.isLoading;`
  - `readonly user = this.#state.user;`
  - `readonly isAuthenticated = this.#state.isAuthenticated;`
  - `readonly authState = this.#state.authState;`
- Delegate methods to appropriate services:
  - `initializeAuthState() { return this.#session.initializeAuthState(); }`
  - `getCurrentSession() { return this.#session.getCurrentSession(); }`
  - `refreshSession() { return this.#session.refreshSession(); }`
  - `signInWithEmail(...args) { return this.#credentials.signInWithEmail(...args); }`
  - `signUpWithEmail(...args) { return this.#credentials.signUpWithEmail(...args); }`
  - `getOAuthUserMetadata() { return this.#oauth.getOAuthUserMetadata(); }`
  - `signInWithGoogle() { return this.#oauth.signInWithGoogle(); }`
  - `setSession(session) { this.#demo.setSession(session); }`
  - `signOut() { return this.#cleanup.signOut(); }`
- Keep AuthState interface export at bottom of file
- Pattern: Pure delegation, no logic in facade
- Consider: Maintains exact API surface for 24 consumers

#### `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts` (REFACTOR)
- Remove tests that duplicate service-specific tests
- Add delegation verification tests:
  - Test that authState signal comes from AuthStateService
  - Test that signInWithEmail() delegates to AuthCredentialsService
  - Test that signOut() delegates to AuthCleanupService
- Keep integration tests for public API surface:
  - Test that facade exposes correct signals
  - Test that method calls propagate to correct services
- Mock all 6 injected services with spy objects
- Verify no business logic in facade (pure delegation)
- Pattern: Test delegation, not implementation

---

### Phase 8: Barrel Export Update

#### `frontend/projects/webapp/src/app/core/auth/index.ts` (UPDATE)
- Add exports for all 6 new services:
  - `export * from './auth-state.service';`
  - `export * from './auth-session.service';`
  - `export * from './auth-credentials.service';`
  - `export * from './auth-oauth.service';`
  - `export * from './auth-demo.service';`
  - `export * from './auth-cleanup.service';`
- Keep existing exports:
  - `export * from './auth-api';` (now facade)
  - `export * from './auth-guard';`
  - `export * from './auth-interceptor';`
  - etc.
- Consider: Enables gradual migration for consumers

---

## Testing Strategy

### Unit Tests to Create
- `auth-state.service.spec.ts` (~50 lines): Test signal behavior, mutations, computed state
- `auth-session.service.spec.ts` (~60 lines): Test session management, E2E bypass, Supabase integration
- `auth-credentials.service.spec.ts` (~50 lines): Test email/password flows, error handling, E2E bypass
- `auth-oauth.service.spec.ts` (~40 lines): Test OAuth flows, metadata parsing
- `auth-demo.service.spec.ts` (~30 lines): Test session injection
- `auth-cleanup.service.spec.ts` (~50 lines): Test cleanup coordination across services
- `auth-api.spec.ts` (refactored, ~40 lines): Test facade delegation

### Unit Tests to Update
- `auth-api.spec.ts`: Remove implementation tests, add delegation tests

### E2E Tests to Verify
- Login with email/password flow (tests/auth/)
- Signup flow
- Google OAuth flow
- Logout and cleanup verification
- Demo mode activation/deactivation
- Auth guards behavior (hasBudgetGuard, authGuard, publicGuard)
- **CRITICAL**: Verify guards handle cache miss gracefully after removing budget pre-loading

### Manual Testing Checklist
- [ ] Start dev server: `pnpm dev`
- [ ] Sign in with test credentials → verify redirect to budget page
- [ ] Check auth state in main layout shows user info
- [ ] Log out → verify redirect to login, cache cleared
- [ ] Test Google OAuth flow
- [ ] Test demo mode activation
- [ ] Navigate to protected route → verify guard works
- [ ] Navigate without cache → verify guard loads budget check

---

## Documentation

### Comments to Add
- JSDoc deprecation notice on AuthApi facade
- Service-level comments explaining responsibility of each service
- Reference to exploration document in commit message

### Files to Update
- `CLAUDE.md`: No changes needed (auth pattern follows existing conventions)
- `memory-bank/ARCHITECTURE.md`: Could document service split pattern (optional)

---

## Rollout Considerations

### Git Strategy
- Create feature branch: `refactor/auth-api-service-split`
- Commit incrementally (one service at a time with tests)
- Run full test suite before merging to main
- Merge only when ALL tests pass (unit + E2E)

### Incremental Commits
1. `feat(auth): add AuthStateService for signal-based state`
2. `feat(auth): add AuthSessionService for Supabase session management`
3. `feat(auth): add AuthCredentialsService for email/password auth`
4. `feat(auth): add AuthOAuthService for Google OAuth`
5. `feat(auth): add AuthDemoService for demo mode session injection`
6. `feat(auth): add AuthCleanupService for logout cleanup coordination`
7. `refactor(auth): convert AuthApi to facade pattern delegating to specialized services`
8. `feat(auth): export new auth services from barrel`

### Breaking Changes
- **NONE**: Facade pattern maintains exact API for all consumers
- **Budget pre-loading removed**: Guards already handle cache miss, no consumer changes needed

### Migration Path (Optional, for Future)
Consumers can gradually migrate from facade to direct injection:
```typescript
// Old way (still works)
import { AuthApi } from '@core/auth';

// New way (gradually migrate)
import { AuthStateService, AuthCredentialsService } from '@core/auth';
```

Deprecate AuthApi in v2.0 after consumers migrated.

---

## Risk Mitigation

### Circular Dependencies
- **Risk**: AuthCleanupService depends on many services; could create cycles
- **Mitigation**: All dependencies are external (demo, cache, analytics, storage) or within auth module (state, session). No reverse dependencies.

### E2E Test Breakage
- **Risk**: E2E bypass logic scattered across services
- **Mitigation**: All E2E logic centralized in AuthSessionService where initializeAuthState() lives. Other services inherit bypass behavior.

### Regression in Auth Flows
- **Risk**: Splitting could introduce subtle bugs in auth flows
- **Mitigation**: Comprehensive unit tests for each service + full E2E suite + manual testing checklist

### Budget Pre-loading Removal
- **Risk**: Removing budget pre-loading could cause user-visible delays
- **Mitigation**: Guards already handle cache miss gracefully (see has-budget.guard.ts:43-52). Fast path uses cache (instant), slow path fetches (only on first navigation).

---

## Next Steps

1. **Create feature branch**: `git checkout -b refactor/auth-api-service-split`
2. **Implement Phase 1-8** in order (state → session → methods → cleanup → facade)
3. **Run tests after each phase**: `pnpm test -- src/app/core/auth/`
4. **Run full test suite**: `pnpm test && pnpm test:e2e`
5. **Manual testing** using checklist above
6. **Merge to main** when all tests pass
7. **Monitor production** for any auth-related issues
8. **Document migration path** in team docs (optional)
