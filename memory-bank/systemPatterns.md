# Pulpe - System Patterns & Architecture

> Architecture patterns, coding standards, design principles.

---

## Monorepo Structure

```
pulpe-workspace/
├── frontend/         # Angular webapp
├── backend-nest/     # NestJS API
├── ios/              # iOS native app (SwiftUI) — active development
├── landing/          # Landing page (Next.js)
├── shared/           # Zod schemas, types, calculators
└── .claude/          # AI context and rules
```

---

## Frontend Architecture

### 7-Layer Pattern

In `frontend/projects/webapp/src/app/`:

| Layer | Purpose | Loading |
|-------|---------|---------|
| `core/` | Services, guards, interceptors, domain logic | Eager |
| `layout/` | App shell (main layout, navigation, dialogs) | Eager |
| `feature/` | Business domains (pages, isolated) | Lazy |
| `ui/` | Stateless reusable components | Cherry-picked |
| `pattern/` | Stateful reusable components | Imported |
| `styles/` | SCSS themes, partials, vendor styles | Global |
| `testing/` | Mock factories, test utilities | Dev only |

### API & State Management Pattern

```
Component → Store → Feature API → ApiClient → HttpClient
             ↑          ↑             ↑
         signals   Observables   Zod validation
```

- **ApiClient** (`core/api/`) — central HTTP, mandatory Zod schema validation
- **Feature APIs** — domain endpoints return `Observable<T>` (e.g., `BudgetApi`, `TemplateApi`)
- **Stores** — signal state, `resource()` for loading, SWR (stale-while-revalidate) refetch UX
- **Components** — read signals, call store mutations

Rule: **NEVER inject HttpClient directly** — all HTTP via ApiClient.

### Core Layer Domains

`core/` layer has domain services:

- `api/` - Central ApiClient + Zod validation
- `auth/` - Auth, guards, session
- `analytics/` - PostHog tracking
- `budget/` - Budget calc
- `budget-template/` - Template API
- `cache/` - Data cache (`DataCache`)
- `config/` - App config
- `currency/` - Currency conversion (rate fetch, 5min cache), conversion badge component
- `date/` - Date utils
- `demo/` - Demo mode services
- `encryption/` - Client-key mgmt, vault code
- `lifecycle/` - App lifecycle hooks
- `loading/` - Loading state
- `logging/` - Logging
- `maintenance/` - Maintenance mode detect
- `preload/` - Critical data preload on auth (allSettled)
- `product-tour/` - Guided tour
- `routing/` - Route guards, nav
- `storage/` - LocalStorage, persistence
- `theme/` - Theme mgmt
- `transaction/` - Transaction API
- `turnstile/` - Cloudflare Turnstile captcha
- `user-settings/` - User prefs
- `validators/` - Custom form validators

### Feature Domains

Features in `feature/`:

- `auth/` - Login, signup
- `budget/` - Budget overview
- `budget-templates/` - Template mgmt
- `complete-profile/` - Onboarding
- `current-month/` - Main budget view
- `design-system/` - Design system showcase/dev ref
- `legal/` - Privacy, terms
- `maintenance/` - Maintenance page
- `settings/` - User settings
- `welcome/` - Welcome flow

### Pattern Layer

Stateful reusable components in `pattern/`:

- `edit-transaction-form/` - Transaction edit form
- `google-oauth/` - Google OAuth button/flow

### Dependency Rules

```
core ← layout, feature, pattern
ui ← layout, feature, pattern
pattern ← feature
Features isolated (no sibling imports)
```

### Key Patterns

- **Standalone Components**: No NgModules
- **OnPush + Signals**: Performance
- **Features as Black Boxes**: Isolated, lazy-loaded
- **Store Pattern**: 6-section anatomy (Dependencies, State, Resource, Selectors, Mutations, Private utils) — see `.claude/rules/angular-store-pattern.md`

### Demo Mode Pattern

- `DemoModeService`: Signal state (localStorage sync)
- `DemoInitializerService`: API call + Supabase auth setup
- UI: Welcome screen + login page demo buttons

---

## Backend Architecture

### Directory Structure

```
backend-nest/src/
├── app.module.ts     # Root module
├── main.ts           # Application bootstrap
├── common/           # Shared utilities (guards, filters, decorators)
├── config/           # Configuration modules
├── database/         # Database utilities
├── modules/          # Domain modules
├── test/             # Test utilities
└── types/            # TypeScript types (database.types.ts)
```

### Common Layer

In `src/common/`:

| Directory | Purpose |
|-----------|---------|
| `constants/` | Shared constants |
| `decorators/` | `@User()`, `@SupabaseClient()` |
| `dto/` | Shared DTOs |
| `exceptions/` | `BusinessException` |
| `filters/` | Exception filters |
| `guards/` | `AuthGuard`, rate limiting |
| `interceptors/` | Request/response interceptors |
| `logger/` | Logging service |
| `middleware/` | Request middleware |
| `services/` | Shared services |
| `utils/` | Utility functions |

### Module Structure

Each domain in `src/modules/[domain]/`:

```
[domain]/
├── [domain].controller.ts   # HTTP routes + validation
├── [domain].service.ts      # Business logic
├── [domain].repository.ts   # Data access layer
├── [domain].calculator.ts   # Domain calculations (optional)
├── [domain].validator.ts    # Domain validation (optional)
├── [domain].mappers.ts      # DTO ↔ Entity transformation
├── [domain].module.ts       # NestJS module definition
├── [domain].constants.ts    # Domain constants (optional)
├── dto/                     # NestJS DTOs (createZodDto from shared)
├── schemas/                 # Additional Zod schemas (optional)
└── __tests__/               # Integration tests (optional)
```

### Current Modules

- `account-deletion/` - Account deletion flow
- `auth/` - Auth endpoints
- `budget/` - Budget CRUD + calc
- `budget-line/` - Budget line mgmt
- `budget-template/` - Template CRUD
- `cache/` - Cache service
- `currency/` - Currency rate fetch (Frankfurter API, 24h cache) + conversion metadata mapping
- `demo/` - Demo mode API
- `debug/` - Debug endpoints (dev only)
- `encryption/` - Server-side encryption key mgmt
- `supabase/` - Supabase client
- `transaction/` - Transaction mgmt
- `user/` - User mgmt

### Authentication & Security

- JWT via Supabase Auth
- `AuthGuard` + `@User()` + `@SupabaseClient()` decorators
- RLS policies enforce data isolation at DB level
- Zero Trust: all endpoints protected by default

### iOS Auth State Machine

```
                 ┌──────────┐
                 │ loading  │ ← app launch / checkAuthState()
                 └────┬─────┘
        ┌─────────────┼───────────────┐
        ▼             ▼               ▼
┌───────────────┐ ┌──────────┐ ┌─────────────┐
│unauthenticated│ │needsPin  │ │needsPinEntry│ ← grace period lock (30s)
│               │ │  Setup   │ │             │   or cold start/first login
└───────┬───────┘ └────┬─────┘ └──────┬──────┘
        │ login()      │ complete     │ PIN or Face ID
        │              │ PinSetup()   │ completePinEntry()
        ▼              ▼              ▼
                ┌──────────────┐
                │authenticated │ → background >= 30s → needsPinEntry
                └──────────────┘
                       │
           startRecovery() ↓
                ┌──────────────────┐
                │needsPinRecovery  │ → completeRecovery() → authenticated
                └──────────────────┘
```

**Key transitions:**

| Event | From | To | ClientKey impact |
|-------|------|----|-----------------|
| Grace period (>= 30s) | `authenticated` | `needsPinEntry` | `clearCache()` — in-memory only, biometric keychain preserved |
| Stale client key | `authenticated` | `needsPinEntry` | `clearAll()` — everything wiped |
| Logout (biometric on) | `authenticated` | `unauthenticated` | `clearSession()` — biometric keychain preserved for next Face ID login |
| Logout (biometric off) | `authenticated` | `unauthenticated` | Full clear via logout flow |
| Password reset | any | `unauthenticated` | `clearAll()` + biometric disabled |

### Analytics (PostHog — Cross-Platform)

Frontend (Angular) + iOS (SwiftUI) share PostHog project (EU region).

| Aspect | Frontend (Angular) | iOS (SwiftUI) |
|--------|-------------------|---------------|
| Service | `PostHogService` (`core/analytics/`) | `AnalyticsService` (`Core/Analytics/`) |
| Pattern | Injectable service | `@MainActor final class` singleton |
| SDK | `posthog-js` | `posthog-ios` (SPM) |
| Screen tracking | Auto-capture | Manual via `.trackScreen()` view modifier |
| Sanitization | `posthog-sanitizer.ts` | `AnalyticsService.sanitizeProperties()` — word-component matching |
| Config | `environment.ts` | `AppConfiguration` + xcconfig files |
| Disabled in | — | Local env (`POSTHOG_ENABLED = false`) |

**Event naming**: `snake_case`, `object_action` pattern — shared cross-platform.

**Onboarding funnel (iOS)**:
```
app_opened → welcome_screen_viewed → signup_started
→ onboarding_step_completed (×3) → signup_completed
→ pin_setup_completed → budget_created → transaction_created
```

**Financial data sanitization**: properties split by `_`, each component checked vs word set (`amount`, `balance`, `income`, `savings`, `total`, `projection`, `rollover`, `expenses`, `available`). Catches compound keys like `total_amount`, `current_balance`.

**User identification**: `identify(userId:, properties:)` called in `applyPostAuthDestination()` (covers login + signup). `early_adopter` person property (from Supabase `auth.users.app_metadata.early_adopter`) passed every identify call to drive PostHog feature flag targeting. Reset on logout.

### Feature Flags (PostHog — Cross-Platform)

Single source of truth in `shared/src/feature-flags.ts` :

```typescript
export const FEATURE_FLAGS = {
  MULTI_CURRENCY: 'multi-currency-enabled',
} as const;

export const ANALYTICS_PROPERTIES = {
  EARLY_ADOPTER: 'early_adopter',
} as const;
```

iOS mirrors `FEATURE_FLAGS.MULTI_CURRENCY` manually as `FeatureFlagsStore.multiCurrencyKey` + `ANALYTICS_PROPERTIES.EARLY_ADOPTER` as `AnalyticsService.earlyAdopterProperty` (sync-comment back to shared TS file).

| Aspect | Frontend (Angular) | iOS (SwiftUI) |
|--------|-------------------|---------------|
| Service | `FeatureFlagsService` (`core/feature-flags/`) | `FeatureFlagsStore` (`Domain/Store/`) |
| Pattern | Injectable + `computed()` signals | `@Observable @MainActor final class` |
| Reactivity | `PostHogService.flagsVersion` signal bumped via `posthog.onFeatureFlags()` | `refresh()` reads `AnalyticsService.isFeatureEnabled()` + updates `@Observable` property |
| Persistence | Built into posthog-js (localStorage) | UserDefaults (avoid boot-time flicker) |
| Refresh triggers | Auto via posthog-js | `.task` at root + `.onChange(of: scenePhase = .active)` |

**Usage pattern** :

```typescript
// Frontend — adding a new flag
readonly isXxxEnabled = computed(() => {
  this.#posthog.flagsVersion(); // reactive dep
  return this.#posthog.isFeatureEnabled(FEATURE_FLAGS.XXX);
});
```

```swift
// iOS — adding a new flag in FeatureFlagsStore
private(set) var isXxxEnabled: Bool
// + read from AnalyticsService.isFeatureEnabled() in refresh()
```

**Targeting strategy** : person property `early_adopter` (from Supabase) → PostHog dashboard conditions. Enables dashboard-only rollout, no deploy (cf. DR-013).

**Central gating** : prefer one entry point per feature, avoid dispersion.
- Multi-currency frontend : `injectCurrencyFormConfig()` returns gated `showCurrencySelector` → 8 forms transparent
- Multi-currency iOS : `UserSettingsStore.showCurrencySelectorEffective` (flag && user toggle) → 6 sheets transparent

**Flag lifecycle** : 3 phases (cf. DR-013) — targeted rollout via dashboard → 100% via dashboard → PR `chore: remove <flag>` after stabilization. **Feature flags temporary by default** — flag forever = tech debt.

### Error Handling Pattern

- `BusinessException` for domain errors
- Cause chain preserved
- "Log or throw, not both" principle

---

## Data Architecture

### Core Tables

```sql
auth.users              -- Managed by Supabase Auth
public.monthly_budget   -- Monthly budget instances
public.transaction      -- Financial transactions
public.template         -- Budget templates (reusable)
public.template_line    -- Template transaction items
```

### Data Flow

```
Frontend DTO (Zod) → Backend DTO (createZodDto) → Service → Repository → Supabase Client → RLS → PostgreSQL
```

### Key Calculations

```
Available = Income + Rollover (from previous month)
Remaining = Available - Expenses
Ending Balance = Remaining (becomes next month's rollover)
```

### Envelope Pattern (BudgetFormulas)

`calculateAllMetrics` = single entry point for budget metric calc. Delegates to:

- `calculateTotalIncome` — income + envelope logic + kind filter
- `calculateTotalExpenses` — expenses/savings + envelope logic + kind filter
- `calculateTotalSavings` — savings + envelope logic + free saving transactions

All use same rule: per budget line, `effective = max(line.amount, consumed)` where consumed only counts transactions matching line's kind category (income vs outflow). Free transactions (no `budgetLineId`) added separately. Ensures:
1. Allocated transactions never double-counted
2. Misallocated transaction (e.g., income tx on expense line) won't inflate wrong total
3. `totalSavings` includes envelope-covered savings + free saving transactions

Backend, frontend, iOS all delegate to shared logic (iOS has Swift port, identical semantics).

---

## Shared Package (pulpe-shared)

Single source of truth for API contracts.

### Structure

```
shared/
├── index.ts              # Main exports
├── schemas.ts            # Zod schemas (DTOs, enums)
└── src/
    ├── types.ts          # Shared TypeScript types
    ├── api-response.ts   # Response schema factories (createApiResponse, etc.)
    └── calculators/      # Business logic calculators
        ├── budget-formulas.ts
        └── budget-period.ts
```

### What to Include

- API types + DTOs
- Form validation schemas
- Business enums
- Shared calculators

### What to Exclude

- Database types
- Backend implementation
- Frontend UI types

### ESM Requirements

Exports use `.js` extension for Node.js ESM compat:

```typescript
// Required for ESM resolution
export { BudgetFormulas } from './budget-formulas.js';
```

### Usage

```typescript
// Frontend
import { budgetCreateSchema, type BudgetCreate } from 'pulpe-shared';

// Backend
import { budgetCreateSchema } from 'pulpe-shared';
export class CreateBudgetDto extends createZodDto(budgetCreateSchema) {}
```

---

## Testing Patterns

| Type | Purpose | Tool |
|------|---------|------|
| Unit | Business logic with mocked dependencies | Vitest |
| Integration | API endpoints with real database | Vitest |
| E2E | Critical user flows | Playwright |

### Test File Conventions

- Frontend: `*.spec.ts` same dir
- Backend: `*.spec.ts` same dir or `__tests__/`
- E2E: `frontend/e2e/tests/**/*.spec.ts`

### E2E Structure

```
frontend/e2e/
├── auth.setup.ts       # Auth fixture
├── pages/              # Page objects
├── tests/
│   ├── critical-path/  # Core flow tests
│   ├── features/       # Feature-specific tests
│   └── smoke/          # Quick validation tests
├── fixtures/           # Test data
├── helpers/            # Test utilities
├── mocks/              # Mock services
└── utils/              # Shared utilities
```

### Frontend Test Utilities

In `frontend/projects/webapp/src/app/testing/`:

- `mock-factories.ts` - Entity factories
- `signal-test-utils.ts` - Signal testing helpers
- `mock-posthog.ts` - Analytics mocking
- `turnstile-mock.ts` - Captcha mocking

---

## Naming Conventions

### Files

- Components: `kebab-case.component.ts` or `kebab-case.ts`
- Services: `kebab-case.service.ts`
- Modules: `kebab-case.module.ts`

### Code

- Classes: `PascalCase`
- Functions/methods: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Interfaces: `PascalCase` (no `I` prefix)

---

## Performance Patterns

### Frontend

- OnPush change detection (90% cycle reduction)
- Signal state (no zone.js overhead)
- Lazy loading all features

### Backend

- Bun runtime (3x faster I/O than Node.js)
- Connection pooling via Supabase
- User-based rate limiting (1000 req/min)

---

*See `techContext.md` for technical decisions.*
*See `INFRASTRUCTURE.md` for deployment details.*