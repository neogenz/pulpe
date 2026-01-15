# Task: Refactor auth-api.ts Service Split

**Objective**: Split the 475-line `auth-api.ts` service into focused, single-responsibility services following the clean code rule of ≤300 lines per file.

---

## Executive Summary

The AuthApi service can be naturally split into **6 focused services** based on clear responsibility boundaries discovered through comprehensive codebase analysis. The service handles authentication state, session management, OAuth, credentials, demo mode integration, and cleanup coordination. All consumers (24 files) depend on specific methods or signals, making a facade pattern ideal for maintaining backward compatibility during refactoring.

**Key Metrics**:
- Current: 475 lines (58% over limit)
- Target: 6 services averaging ~80 lines each
- Consumers: 24 files across guards, interceptors, components, and services
- Dependencies: 8 injected services (Supabase, cache, analytics, storage, logging, demo, budget)

---

## Codebase Context

### Current Auth-API Structure

**File**: `frontend/projects/webapp/src/app/core/auth/auth-api.ts` (475 lines)

#### Responsibility Breakdown

| Responsibility | Lines | Methods | Public API Surface |
|----------------|-------|---------|-------------------|
| **State Management** | 57-83, 215-218 | #sessionSignal, #isLoadingSignal, #userSignal, #updateAuthState | authState, session, user, isLoading, isAuthenticated |
| **Session & Client** | 108-190, 421-466 | initializeAuthState(), getCurrentSession(), refreshSession(), #supabaseClient | getCurrentSession(), refreshSession() |
| **Credentials Auth** | 256-316 | signInWithEmail(), signUpWithEmail() | signInWithEmail(), signUpWithEmail() |
| **OAuth Auth** | 85-106, 318-346 | getOAuthUserMetadata(), signInWithGoogle() | getOAuthUserMetadata(), signInWithGoogle() |
| **Demo Mode** | 356-392 | setSession() | setSession() |
| **Cleanup/Logout** | 220-254, 394-419 | signOut(), #handleSignOut(), #preloadHasBudgetFlag() | signOut() |
| **E2E Testing** | 122-135, 200-213, 260-263, 291-294, 319-322, 396-409 | #isE2EBypass(), #getE2EMockState(), #setE2EMockState() | E2E window properties |

#### Dependencies Injected

```typescript
readonly #errorLocalizer = inject(AuthErrorLocalizer);         // Line 45
readonly #applicationConfig = inject(ApplicationConfiguration); // Line 46
readonly #logger = inject(Logger);                             // Line 47
readonly #demoModeService = inject(DemoModeService);           // Line 48
readonly #postHogService = inject(PostHogService);             // Line 49
readonly #storageService = inject(StorageService);             // Line 50
readonly #hasBudgetCache = inject(HasBudgetCache);             // Line 51
readonly #budgetApi = inject(BudgetApi);                       // Line 52
```

**⚠️ Circular Dependency Risk**: AuthApi injects BudgetApi (for #preloadHasBudgetFlag), but BudgetApi only uses HasBudgetCache. Safe currently, but must be careful when splitting.

#### Signal Architecture

```typescript
// Private writable signals (Lines 57-59)
readonly #sessionSignal = signal<Session | null>(null);
readonly #isLoadingSignal = signal(true);
readonly #userSignal = computed(() => this.#sessionSignal()?.user ?? null);

// Public readonly signals (Lines 67-81)
readonly session = this.#sessionSignal.asReadonly();
readonly isLoading = this.#isLoadingSignal.asReadonly();
readonly user = this.#userSignal;
readonly isAuthenticated = computed(() => this.#sessionSignal() !== null);
readonly authState = computed<AuthState>(() => ({
  user: this.#userSignal(),
  session: this.#sessionSignal(),
  isLoading: this.#isLoadingSignal(),
  isAuthenticated: this.isAuthenticated(),
}));
```

---

### Usage Analysis (24 Consumer Files)

#### High-Frequency Consumers

| File | Method/Signal | Usage Pattern |
|------|--------------|---------------|
| `auth-guard.ts:17-37` | `authState` | Reads signal synchronously when available |
| `public-guard.ts:20-30` | `authState` | Redirects authenticated users away from public pages |
| `auth-interceptor.ts:41-95` | `getCurrentSession()`, `refreshSession()`, `signOut()`, `isAuthenticated()` | Token management and 401 handling |
| `main-layout.ts:399,515` | `authState`, `signOut()` | User menu display and logout button |
| `login.ts:224` | `signInWithEmail()` | Login form submission |
| `signup.ts` | `signUpWithEmail()` | Registration form submission |
| `demo-initializer.service.ts:83,133` | `setSession()`, `signOut()` | Demo mode activation/deactivation |
| `google-oauth-button.ts` | `signInWithGoogle()` | OAuth button click handler |
| `complete-profile-store.ts` | Used indirectly via guards | Profile setup flow |

#### Low-Frequency but Critical

- `has-budget.guard.ts`: Indirectly uses HasBudgetCache cleared by AuthApi on logout
- `user-settings-api.ts:30-42`: Depends on `isAuthenticated()` for resource params
- `budget-api.ts:85-99`: Updates HasBudgetCache that AuthApi clears
- Multiple components: Read `authState` for conditional rendering (e.g., show/hide features)

---

### Existing Service Composition Patterns

The codebase already has excellent examples of focused services:

#### ✅ **HasBudgetCache** (33 lines)

```typescript
@Injectable({ providedIn: 'root' })
export class HasBudgetCache {
  readonly #hasBudget = signal<boolean | null>(null);

  get(): boolean | null { return this.#hasBudget(); }
  setHasBudget(value: boolean): void { this.#hasBudget.set(value); }
  clear(): void { this.#hasBudget.set(null); }
}
```

**Pattern**: Single-responsibility cache with signal-based state. Clean, focused API.

#### ✅ **DemoModeService** (76 lines)

```typescript
@Injectable({ providedIn: 'root' })
export class DemoModeService {
  readonly #isDemoModeSignal = signal(initialIsDemoMode);
  readonly #demoUserEmailSignal = signal<string | null>(initialDemoEmail);
  readonly #demoUserIdSignal = signal<string | null>(initialDemoUserId);

  readonly isDemoMode = this.#isDemoModeSignal.asReadonly();
  readonly demoUserEmail = this.#demoUserEmailSignal.asReadonly();
  readonly demoUserId = this.#demoUserIdSignal.asReadonly();
  readonly demoUserDisplayName = computed(() => /* ... */);

  constructor() {
    effect(() => { /* Sync to localStorage */ });
  }

  activateDemoMode(email: string, userId: string): void { /* ... */ }
  deactivateDemoMode(): void { /* ... */ }
}
```

**Pattern**: Private signals with readonly exposure, computed derived state, effect for persistence.

#### ✅ **UserSettingsApi** (146 lines) - Service Composition Example

```typescript
@Injectable({ providedIn: 'root' })
export class UserSettingsApi {
  readonly #httpClient = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #authApi = inject(AuthApi); // Depends on another core service
  readonly #logger = inject(Logger);

  readonly #settingsResource = resource({
    params: () => ({
      isAuthenticated: this.#authApi.isAuthenticated(), // Consumes auth state
      trigger: this.#reloadTrigger(),
    }),
    loader: /* ... */
  });

  readonly settings = computed(() => this.#settingsResource.value());
  readonly isLoading = computed(() => this.#settingsResource.isLoading());
}
```

**Pattern**: Service composition via `inject()`, depends on AuthApi.isAuthenticated() signal, uses resource() pattern.

#### ✅ **BudgetApi** (387 lines) - Error Handling Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class BudgetApi {
  readonly #httpClient = inject(HttpClient);
  readonly #storageService = inject(StorageService);
  readonly #hasBudgetCache = inject(HasBudgetCache);

  getAllBudgets$(): Observable<Budget[]> {
    return this.#httpClient.get<unknown[]>(`${this.#apiUrl}/budgets`).pipe(
      map((data) => data.map((item) => budgetResponseSchema.parse(item))),
      tap((budgets) => this.#hasBudgetCache.setHasBudget(budgets.length > 0)),
      tap((budgets) => this.#saveBudgetToStorage(budgets)),
      catchError((error) => this.#handleApiError(error, 'getAllBudgets')),
    );
  }

  #handleApiError(error: unknown, context: string): Observable<never> {
    const localizedMessage = this.#getLocalizedErrorMessage(error);
    this.#logger.error(`BudgetApi.${context} error:`, error);
    return throwError(() => new Error(localizedMessage));
  }
}
```

**Pattern**: Observable-based API service with consistent error handling, storage caching, and cross-service cache updates.

---

## Documentation Insights

### Angular Service Splitting Best Practices

#### 1. **Single Responsibility Principle (SRP)**

Each service should handle one cohesive concern:
- ✅ **Good**: `SessionService` manages tokens, refresh, validation
- ❌ **Bad**: `AuthService` handles state + session + OAuth + credentials + cleanup

#### 2. **Service Composition via inject()**

Modern Angular uses `inject()` for clean dependency management:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private session = inject(SessionService);
  private oauth = inject(OAuthService);

  async login(credentials: Credentials): Promise<void> {
    const session = await this.session.validateSession();
    // Use composed services
  }
}
```

**Benefits**:
- Better type inference
- Cleaner constructor
- Easier testing (mock via TestBed providers)

#### 3. **Facade Pattern for Backward Compatibility**

When splitting a large service, use a facade to maintain the existing API:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private auth = inject(AuthenticationService);
  private session = inject(SessionService);
  private oauth = inject(OAuthService);

  // Public, simplified API delegates to specialized services
  login(credentials: Credentials) { return this.auth.login(credentials); }
  logout() { return this.auth.logout(); }
  getCurrentSession() { return this.session.getCurrentSession(); }
}
```

**When to use**:
- Large refactoring with many consumers
- Need gradual migration
- Want to hide internal composition complexity

**Alternative**: Direct injection of focused services (breaking change, requires updating all consumers)

#### 4. **Preventing Circular Dependencies**

Angular throws **NG0200** error when services form a cycle. Prevention strategies:

**Strategy 1: Extract Shared Functionality**

```typescript
// ❌ Circular: AuthApi → BudgetApi → AuthApi
// ✅ Solution: Extract HasBudgetCache (neither depends on the other)

@Injectable({ providedIn: 'root' })
export class HasBudgetCache {
  // Shared by both AuthApi and BudgetApi
}
```

**Strategy 2: Interface Segregation**

```typescript
// Define interface instead of concrete dependency
interface ISessionValidator {
  validate(): Observable<boolean>;
}

export const SESSION_VALIDATOR = new InjectionToken<ISessionValidator>('SessionValidator');

@Injectable({ providedIn: 'root' })
export class AuthService {
  private validator = inject(SESSION_VALIDATOR);
}
```

**Strategy 3: Lazy Injection with Injector**

```typescript
import { Injector } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthInterceptor {
  private injector = inject(Injector);

  intercept(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    // Lazy inject after bootstrap
    const authService = this.injector.get(AuthService);
    const token = authService.getToken();
    // ...
  }
}
```

#### 5. **Signals for Shared State Across Services**

**Pattern**: Private writable signal + public readonly exposure

```typescript
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private _user = signal<User | null>(null);
  private _isLoading = signal(false);

  // Public read-only
  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // Derived state
  readonly isAuthenticated = computed(() => this._user() !== null);

  // Mutations
  setUser(user: User | null) { this._user.set(user); }
  setLoading(loading: boolean) { this._isLoading.set(loading); }
}
```

**Reactive Service Composition**:

```typescript
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private authState = inject(AuthStateService);

  // Automatically recomputes when user changes
  readonly permissions = computed(() => {
    const user = this.authState.user();
    return user?.permissions ?? [];
  });

  canAccess(resource: string): boolean {
    return this.permissions().includes(resource);
  }
}
```

**Benefits**:
- No manual subscription management
- Automatic dependency tracking
- Synchronous reads (no async ceremony)
- OnPush-compatible by default

---

### Supabase Authentication Architecture

#### Recommended Service Structure

**Layer 1: Client Management**

```typescript
@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private supabase = createClient(env.supabaseUrl, env.supabaseKey);
  getClient() { return this.supabase; }
}
```

**Layer 2: Auth Operations**

```typescript
@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private supabase = inject(SupabaseClientService);

  signUp(email: string, password: string) {
    return this.supabase.getClient().auth.signUp({ email, password });
  }

  signInWithOAuth(provider: 'google') {
    return this.supabase.getClient().auth.signInWithOAuth({ provider });
  }
}
```

**Layer 3: Session Management**

```typescript
@Injectable({ providedIn: 'root' })
export class SessionService {
  private supabase = inject(SupabaseClientService);
  private _session = signal<Session | null>(null);
  readonly session = this._session.asReadonly();

  constructor() {
    effect(() => {
      this.supabase.getClient().auth.onAuthStateChange((event, session) => {
        this._session.set(session);
      });
    });
  }
}
```

**Layer 4: Composite Facade**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private supAuth = inject(SupabaseAuthService);
  private session = inject(SessionService);

  readonly user = computed(() => this.session.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  async signIn(email: string, password: string) {
    await this.supAuth.signIn(email, password);
  }
}
```

---

## Research Findings

### Real-World Angular Authentication Service Split Examples

#### 1. **Angular Authentication GitHub Project**

Repository structure for authentication concerns:

```
src/app/core/auth/
├── guards/
│   ├── auth.guard.ts           # Route protection
│   └── no-auth.guard.ts        # Redirect authenticated users
├── interceptors/
│   └── auth-token.interceptor.ts  # Add Bearer token
├── tokens/
│   └── auth-tokens.ts          # InjectionToken definitions
├── services/
│   ├── auth.service.ts         # Orchestration facade
│   ├── auth-storage.service.ts # localStorage management
│   └── jwt.service.ts          # Token decode/validation
├── models/
│   └── auth.models.ts          # User, Session interfaces
└── index.ts                    # Barrel export
```

**Key Patterns**:
- Separate folders for guards, interceptors, services
- Storage abstraction (`AuthStorageService`)
- JWT handling separate from auth logic
- Facade service coordinates subsystems

#### 2. **Service Splitting Migration Strategy**

**Phase 1: Create New Services (No Breaking Changes)**

```typescript
// Step 1: Extract focused services
@Injectable({ providedIn: 'root' })
export class AuthStateService { /* state signals */ }

@Injectable({ providedIn: 'root' })
export class AuthSessionService { /* session CRUD */ }

@Injectable({ providedIn: 'root' })
export class AuthCredentialsService { /* email/password */ }
```

**Phase 2: Create Facade Delegating to New Services**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private state = inject(AuthStateService);
  private session = inject(AuthSessionService);
  private credentials = inject(AuthCredentialsService);

  // Public API unchanged - delegates internally
  readonly authState = this.state.authState;
  signInWithEmail(...args) { return this.credentials.signInWithEmail(...args); }
  getCurrentSession() { return this.session.getCurrentSession(); }
}
```

**Phase 3: Update Consumers Gradually**

```typescript
// Old import (still works via facade)
import { AuthApi } from '@core/auth/auth-api';

// New import (gradually migrate consumers)
import { AuthFacade } from '@core/auth/auth-facade';
import { AuthStateService } from '@core/auth/auth-state.service';
```

**Phase 4: Deprecate Old Service**

```typescript
// auth-api.ts (mark deprecated)
/**
 * @deprecated Use AuthFacade or inject specific services (AuthStateService, AuthSessionService, etc.)
 * Will be removed in v2.0
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  // Keep for backward compatibility, delegate to new services
}
```

#### 3. **Anti-Patterns to Avoid**

❌ **Service-Per-Method** - Too granular
```typescript
// BAD: Over-splitting
export class LoginService { login() {} }
export class LogoutService { logout() {} }
export class RefreshService { refreshToken() {} }
```

❌ **Exposing Internal Signals** - Breaks encapsulation
```typescript
// BAD: Public writable signal
export class AuthStateService {
  readonly userSignal = signal<User | null>(null); // Anyone can call .set()!
}

// GOOD: Private signal with readonly exposure
export class AuthStateService {
  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  setUser(user: User | null) { this._user.set(user); }
}
```

❌ **Mixing Concerns** - State + API + Business Logic
```typescript
// BAD: Single service doing everything
export class UserService {
  private http = inject(HttpClient);
  readonly users = signal<User[]>([]);

  loadUsers() { /* HTTP + state update + validation */ }
  calculateDiscount(user: User) { /* business logic */ }
  saveToCache(users: User[]) { /* storage logic */ }
}

// GOOD: Separate services
// - UserApiService (HTTP)
// - UserStateService (signals)
// - UserBusinessLogic (calculations)
// - UserCacheService (storage)
```

---

## Key Files to Modify

### Primary Target

| File | Current Lines | Action |
|------|--------------|--------|
| `frontend/projects/webapp/src/app/core/auth/auth-api.ts` | 475 | Split into 6 services + facade |
| `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts` | 173 | Split tests to match new services |

### Files to Create

| New File | Estimated Lines | Responsibility |
|----------|----------------|----------------|
| `auth-state.service.ts` | ~80 | Signal-based state management (#sessionSignal, #isLoadingSignal, #userSignal, computed authState) |
| `auth-session.service.ts` | ~120 | Supabase client initialization, session CRUD, token refresh, auth state change listener |
| `auth-credentials.service.ts` | ~80 | Email/password signIn and signUp |
| `auth-oauth.service.ts` | ~70 | Google OAuth, metadata extraction |
| `auth-demo.service.ts` | ~50 | setSession for demo mode integration |
| `auth-cleanup.service.ts` | ~90 | signOut, #handleSignOut, cleanup coordination (demo, cache, analytics, storage) |
| `auth-facade.service.ts` | ~60 | Public API facade delegating to specialized services (optional, for backward compatibility) |
| `auth-state.service.spec.ts` | ~50 | Tests for state service |
| `auth-session.service.spec.ts` | ~60 | Tests for session service |
| `auth-credentials.service.spec.ts` | ~50 | Tests for credentials service |
| `auth-oauth.service.spec.ts` | ~40 | Tests for OAuth service |
| `auth-cleanup.service.spec.ts` | ~50 | Tests for cleanup service |
| `index.ts` (updated) | ~20 | Barrel export for all auth services |

**Total**: ~820 lines across 13 files (average ~63 lines per file)

### Consumers to Update (If Not Using Facade)

If we choose **direct injection** instead of facade pattern:

| File | Current Import | New Import |
|------|---------------|------------|
| `auth-guard.ts` | `AuthApi.authState` | `AuthStateService.authState` |
| `public-guard.ts` | `AuthApi.authState` | `AuthStateService.authState` |
| `auth-interceptor.ts` | `AuthApi.getCurrentSession/refreshSession/signOut` | `AuthSessionService.getCurrentSession/refreshSession`, `AuthCleanupService.signOut` |
| `main-layout.ts` | `AuthApi.authState/signOut` | `AuthStateService.authState`, `AuthCleanupService.signOut` |
| `login.ts` | `AuthApi.signInWithEmail` | `AuthCredentialsService.signInWithEmail` |
| `signup.ts` | `AuthApi.signUpWithEmail` | `AuthCredentialsService.signUpWithEmail` |
| `demo-initializer.service.ts` | `AuthApi.setSession/signOut` | `AuthDemoService.setSession`, `AuthCleanupService.signOut` |
| `google-oauth-button.ts` | `AuthApi.signInWithGoogle` | `AuthOAuthService.signInWithGoogle` |
| `complete-profile-store.ts` | Guards (indirect) | No change if guards updated |
| `user-settings-api.ts` | `AuthApi.isAuthenticated` | `AuthStateService.isAuthenticated` |

**Total**: ~10 files to update (if not using facade)

---

## Patterns to Follow

### 1. **Signal-Based State Service**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  // Private writable signals
  private _session = signal<Session | null>(null);
  private _isLoading = signal(false);

  // Public readonly signals
  readonly session = this._session.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // Derived state (computed)
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly authState = computed<AuthState>(() => ({
    user: this.user(),
    session: this.session(),
    isLoading: this.isLoading(),
    isAuthenticated: this.isAuthenticated(),
  }));

  // Mutation methods
  setSession(session: Session | null): void {
    this._session.set(session);
  }

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }
}
```

### 2. **Service Composition**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private state = inject(AuthStateService);
  private config = inject(ApplicationConfiguration);
  private logger = inject(Logger);

  private supabaseClient: SupabaseClient | null = null;

  async initializeAuthState(): Promise<void> {
    this.state.setLoading(true);

    // Create Supabase client
    this.supabaseClient = createClient(/* ... */);

    // Load session
    const { data: { session } } = await this.supabaseClient.auth.getSession();
    this.state.setSession(session);

    // Listen to auth changes
    this.supabaseClient.auth.onAuthStateChange((event, session) => {
      this.state.setSession(session);
    });

    this.state.setLoading(false);
  }

  async getCurrentSession(): Promise<Session | null> {
    const { data: { session } } = await this.supabaseClient!.auth.getSession();
    return session;
  }

  async refreshSession(): Promise<void> {
    const { data: { session } } = await this.supabaseClient!.auth.refreshSession();
    this.state.setSession(session);
  }
}
```

### 3. **Error Handling Pattern**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthCredentialsService {
  private session = inject(AuthSessionService);
  private state = inject(AuthStateService);
  private errorLocalizer = inject(AuthErrorLocalizer);
  private logger = inject(Logger);

  async signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.state.setLoading(true);

      const { data, error } = await this.session.getClient().auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const localizedError = this.errorLocalizer.localize(error);
        this.logger.warn('signInWithEmail failed:', error);
        return { success: false, error: localizedError };
      }

      this.state.setSession(data.session);
      return { success: true };
    } catch (error) {
      this.logger.error('signInWithEmail exception:', error);
      return { success: false, error: AUTH_ERROR_MESSAGES.GENERIC_ERROR };
    } finally {
      this.state.setLoading(false);
    }
  }
}
```

### 4. **E2E Testing Bypass Pattern**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  async initializeAuthState(): Promise<void> {
    // E2E bypass
    if (this.#isE2EBypass()) {
      const mockState = this.#getE2EMockState();
      this.state.setSession(mockState.session);
      this.state.setLoading(false);
      return;
    }

    // Normal Supabase initialization
    // ...
  }

  #isE2EBypass(): boolean {
    return !!(window as E2EWindow).__E2E_AUTH_BYPASS__;
  }

  #getE2EMockState(): AuthState {
    return (window as E2EWindow).__E2E_MOCK_AUTH_STATE__ ?? initialAuthState;
  }
}
```

### 5. **Cleanup Coordination Pattern**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthCleanupService {
  private state = inject(AuthStateService);
  private session = inject(AuthSessionService);
  private demoMode = inject(DemoModeService);
  private hasBudgetCache = inject(HasBudgetCache);
  private postHog = inject(PostHogService);
  private storage = inject(StorageService);
  private logger = inject(Logger);

  async signOut(): Promise<void> {
    try {
      // Call Supabase signOut
      await this.session.getClient().auth.signOut();

      // Coordinate cleanup across services
      this.#handleSignOut();
    } catch (error) {
      this.logger.error('signOut failed:', error);
    }
  }

  #handleSignOut(): void {
    // Clear auth state
    this.state.setSession(null);

    // Clear demo mode
    if (this.demoMode.isDemoMode()) {
      this.demoMode.deactivateDemoMode();
    }

    // Clear cache
    this.hasBudgetCache.clear();

    // Reset analytics
    this.postHog.reset();

    // Clear storage (preserving tour keys)
    const userId = this.state.user()?.id;
    this.storage.clearAll(userId);

    this.logger.info('User signed out and cleanup completed');
  }
}
```

---

## Dependencies

### Internal Dependencies

| Service | Depends On |
|---------|-----------|
| `AuthStateService` | None (pure state) |
| `AuthSessionService` | AuthStateService, ApplicationConfiguration, Logger |
| `AuthCredentialsService` | AuthSessionService, AuthStateService, AuthErrorLocalizer, Logger |
| `AuthOAuthService` | AuthSessionService, AuthStateService, ApplicationConfiguration, Logger |
| `AuthDemoService` | AuthSessionService, AuthStateService, Logger |
| `AuthCleanupService` | AuthStateService, AuthSessionService, DemoModeService, HasBudgetCache, PostHogService, StorageService, BudgetApi, Logger |
| `AuthFacade` (optional) | All above services |

**Critical**: `AuthCleanupService` must inject `BudgetApi` to call `#preloadHasBudgetFlag()` on login. This creates a dependency from auth → budget. Alternative: move preloading to a separate initialization service or into AuthSessionService.

### External Dependencies

| Package | Used By |
|---------|---------|
| `@supabase/supabase-js` | AuthSessionService (createClient, auth API) |
| `rxjs` | AuthCredentialsService, AuthOAuthService (Observable returns for async operations) |
| `pulpe-shared` | AuthStateService (Session, User types from shared schemas) |

### Circular Dependency Risk

**Current**: AuthApi → BudgetApi → HasBudgetCache
**After Split**: AuthCleanupService → BudgetApi → HasBudgetCache

**Mitigation**: BudgetApi does NOT depend on any auth service, only HasBudgetCache. Safe as long as we don't make BudgetApi depend on AuthStateService.

---

## Questions to Address During Planning

### Architectural Decisions

1. **Facade vs Direct Injection?**
   - **Facade Pattern**: Create `AuthFacade` that maintains current API, delegates to specialized services internally. Consumers unchanged.
   - **Direct Injection**: Update all consumers to inject specific services (e.g., `AuthStateService`, `AuthCredentialsService`). Breaking change.
   - **Recommendation**: Use Facade Pattern initially for backward compatibility. Deprecate old `AuthApi`, migrate consumers gradually.

2. **Where Should Supabase Client Live?**
   - **Option A**: Private field in `AuthSessionService` (centralized)
   - **Option B**: Separate `SupabaseClientService` (reusable by other features like database queries)
   - **Current pattern**: Centralized in AuthApi (Lines 54-56)
   - **Recommendation**: Keep in `AuthSessionService` as private field. No other services need direct Supabase client access in current architecture.

3. **State Signal Ownership?**
   - **Option A**: `AuthStateService` owns all signals (session, isLoading, user)
   - **Option B**: Split signals across services (e.g., `AuthSessionService` owns session signal)
   - **Recommendation**: **Option A** - centralize state in `AuthStateService`. Other services mutate state via setter methods. Clean separation of concerns.

4. **E2E Mock Helpers?**
   - **Option A**: Centralized in `AuthSessionService` (lines 200-213)
   - **Option B**: Separate `AuthTestingService` (only available in test environment)
   - **Recommendation**: Keep in `AuthSessionService` where they're used. Small footprint, already tree-shakeable in production.

5. **Cleanup Orchestration?**
   - **Option A**: Dedicated `AuthCleanupService` coordinates signOut + all cleanup (demo, cache, analytics, storage)
   - **Option B**: Each service handles its own cleanup via events/observables
   - **Recommendation**: **Option A** - centralized orchestration ensures nothing is missed. Single source of truth for cleanup logic.

6. **Budget Pre-loading Dependency?**
   - **Current**: AuthApi injects BudgetApi to call `checkBudgetExists$()` after login (Lines 237-254)
   - **Problem**: Creates auth → budget dependency
   - **Options**:
     - A) Keep in `AuthCleanupService` (maintains current behavior)
     - B) Move to separate `AuthInitializationService`
     - C) Move to `main.ts` as separate APP_INITIALIZER
     - D) Remove - let guards handle it lazily
   - **Recommendation**: **Option C** or **D** - Remove from auth services. Guards already handle cache miss gracefully.

### Testing Strategy

1. **How to test services in isolation?**
   - Mock injected dependencies with TestBed providers
   - Use spy objects for method calls
   - Test public API surface, not implementation details

2. **How to maintain E2E test compatibility?**
   - Preserve window properties (`__E2E_AUTH_BYPASS__`, `__E2E_MOCK_AUTH_STATE__`)
   - Keep E2E helpers in `AuthSessionService`
   - Update E2E test utilities to use new facade or services

3. **How to verify no regressions?**
   - Run full test suite after split (unit + E2E)
   - Test all 24 consumer files for correct behavior
   - Verify guards, interceptors, and components work identically

---

## Next Steps

1. **Review this exploration document** with team/stakeholders
2. **Decide on architectural questions** (facade vs direct, state ownership, etc.)
3. **Run `/workflow:epct:plan 40-refactor-auth-api-service-split`** to create detailed implementation plan
4. **Execute implementation** following the plan
5. **Test thoroughly** (unit tests, E2E tests, manual testing)
6. **Migrate consumers** gradually if using facade pattern
7. **Deprecate old AuthApi** after all consumers migrated

---

## Sources

### Codebase Analysis
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts` (current implementation)
- `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts` (test coverage)
- `frontend/projects/webapp/src/app/core/auth/*.ts` (auth ecosystem)
- `frontend/projects/webapp/src/app/core/*/*.ts` (service composition patterns)
- 24 consumer files across guards, interceptors, components, services

### Documentation
- [Angular Dependency Injection Guide](https://angular.dev/guide/di)
- [Angular Signals Overview](https://angular.dev/guide/signals)
- [Angular Circular Dependency Error (NG0200)](https://angular.dev/errors/NG0200)
- [Supabase Auth Architecture](https://supabase.com/docs/guides/auth/architecture)
- [Build User Management with Angular & Supabase](https://supabase.com/docs/guides/getting-started/tutorials/with-angular)

### Research Articles
- [Mastering Dependency Injection in Angular 2025](https://javascript.plainenglish.io/mastering-dependency-injection-in-angular-2025-the-complete-developer-guide-e8c56af9dc55)
- [Angular Facade Pattern Guide](https://angular.love/angular-facade-pattern/)
- [Service with a Signal vs Subject in Angular](https://modernangular.com/articles/service-with-a-signal-in-angular)
- [Angular Authentication GitHub Repository](https://github.com/nikosanif/angular-authentication)
- [Angular Signals: Complete Guide](https://blog.angular-university.io/angular-signals/)
