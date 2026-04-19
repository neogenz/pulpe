# Pulpe - System Patterns & Architecture

> Architecture patterns, coding standards, and design principles.

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

Located in `frontend/projects/webapp/src/app/`:

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

- **ApiClient** (`core/api/`) — centralized HTTP with mandatory Zod schema validation
- **Feature APIs** — domain endpoints returning `Observable<T>` (e.g., `BudgetApi`, `TemplateApi`)
- **Stores** — signal-based state with `resource()` for loading, SWR (stale-while-revalidate) for refetch UX
- **Components** — read signals, call store mutations

Rule: **NEVER inject HttpClient directly** — all HTTP goes through ApiClient.

### Core Layer Domains

The `core/` layer contains domain-specific services:

- `api/` - Centralized ApiClient with Zod validation
- `auth/` - Authentication, guards, session
- `analytics/` - PostHog tracking
- `budget/` - Budget calculations
- `budget-template/` - Template-related API
- `cache/` - Data caching (`DataCache`)
- `config/` - App configuration
- `currency/` - Currency conversion service (rate fetching, 5min cache), conversion badge component
- `date/` - Date utilities
- `demo/` - Demo mode services
- `encryption/` - Client-key management, vault code
- `lifecycle/` - App lifecycle hooks
- `loading/` - Loading state management
- `logging/` - Logging service
- `maintenance/` - Maintenance mode detection
- `preload/` - Critical data preloading on auth (allSettled)
- `product-tour/` - Guided product tour service
- `routing/` - Route guards, navigation
- `storage/` - LocalStorage, persistence
- `theme/` - Theme management
- `transaction/` - Transaction API
- `turnstile/` - Cloudflare Turnstile captcha integration
- `user-settings/` - User preferences
- `validators/` - Custom form validators

### Feature Domains

Current features in `feature/`:

- `auth/` - Login, signup flows
- `budget/` - Budget overview
- `budget-templates/` - Template management
- `complete-profile/` - Onboarding
- `current-month/` - Main budget view
- `design-system/` - Design system showcase/dev reference
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
- **OnPush + Signals**: For performance
- **Features as Black Boxes**: Isolated, lazy-loaded
- **Store Pattern**: 6-section anatomy (Dependencies, State, Resource, Selectors, Mutations, Private utils) — see `.claude/rules/angular-store-pattern.md`

### Demo Mode Pattern

- `DemoModeService`: Signal-based state (localStorage sync)
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

Located in `src/common/`:

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
- `auth/` - Authentication endpoints
- `budget/` - Budget CRUD + calculations
- `budget-line/` - Budget line management
- `budget-template/` - Template CRUD
- `cache/` - Caching service
- `currency/` - Currency rate fetching (Frankfurter API, 24h cache) and conversion metadata mapping
- `demo/` - Demo mode API
- `debug/` - Debug endpoints (dev only)
- `encryption/` - Server-side encryption key management
- `supabase/` - Supabase client
- `transaction/` - Transaction management
- `user/` - User management

### Authentication & Security

- JWT via Supabase Auth
- `AuthGuard` with `@User()` and `@SupabaseClient()` decorators
- RLS policies enforce data isolation at DB level
- Zero Trust: All endpoints protected by default

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

Both frontend (Angular) and iOS (SwiftUI) share a PostHog project (EU region).

| Aspect | Frontend (Angular) | iOS (SwiftUI) |
|--------|-------------------|---------------|
| Service | `PostHogService` (`core/analytics/`) | `AnalyticsService` (`Core/Analytics/`) |
| Pattern | Injectable service | `@MainActor final class` singleton |
| SDK | `posthog-js` | `posthog-ios` (SPM) |
| Screen tracking | Auto-capture | Manual via `.trackScreen()` view modifier |
| Sanitization | `posthog-sanitizer.ts` | `AnalyticsService.sanitizeProperties()` — word-component matching |
| Config | `environment.ts` | `AppConfiguration` + xcconfig files |
| Disabled in | — | Local env (`POSTHOG_ENABLED = false`) |

**Event naming**: `snake_case`, `object_action` pattern — shared across platforms.

**Onboarding funnel (iOS)**:
```
app_opened → welcome_screen_viewed → signup_started
→ onboarding_step_completed (×3) → signup_completed
→ pin_setup_completed → budget_created → transaction_created
```

**Financial data sanitization**: Properties split by `_`, each component checked against a word set (`amount`, `balance`, `income`, `savings`, `total`, `projection`, `rollover`, `expenses`, `available`). Catches compound keys like `total_amount`, `current_balance`.

**User identification**: `identify(userId:, properties:)` called in `applyPostAuthDestination()` (covers both login and signup). The `early_adopter` person property (sourced from Supabase `auth.users.app_metadata.early_adopter`) is passed on every identify call to drive PostHog feature flag targeting. Reset on logout.

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

iOS mirrors `FEATURE_FLAGS.MULTI_CURRENCY` manually as `FeatureFlagsStore.multiCurrencyKey` and `ANALYTICS_PROPERTIES.EARLY_ADOPTER` as `AnalyticsService.earlyAdopterProperty` (with sync-comment back to the shared TS file).

| Aspect | Frontend (Angular) | iOS (SwiftUI) |
|--------|-------------------|---------------|
| Service | `FeatureFlagsService` (`core/feature-flags/`) | `FeatureFlagsStore` (`Domain/Store/`) |
| Pattern | Injectable + `computed()` signals | `@Observable @MainActor final class` |
| Reactivity | `PostHogService.flagsVersion` signal bumped via `posthog.onFeatureFlags()` | `refresh()` reads `AnalyticsService.isFeatureEnabled()` and updates `@Observable` property |
| Persistence | Built into posthog-js (localStorage) | UserDefaults (avoid boot-time flicker) |
| Refresh triggers | Auto via posthog-js | `.task` at root + `.onChange(of: scenePhase = .active)` |

**Pattern d'usage** :

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

**Targeting strategy** : person property `early_adopter` (provient de Supabase) → conditions PostHog dashboard. Permet un rollout dashboard-only sans déploiement (cf. DR-013).

**Gating centralisé** : préférer un seul point d'entrée par feature pour éviter la dispersion.
- Multi-currency frontend : `injectCurrencyFormConfig()` retourne un `showCurrencySelector` gated → 8 forms transparentes
- Multi-currency iOS : `UserSettingsStore.showCurrencySelectorEffective` (flag && user toggle) → 6 sheets transparentes

**Lifecycle des flags** : 3 phases (cf. DR-013) — rollout ciblé via dashboard → 100% via dashboard → PR `chore: remove <flag>` après stabilisation. **Les feature flags sont temporaires par défaut** — laisser un flag en place forever crée de la dette technique.

### Error Handling Pattern

- `BusinessException` for domain errors
- Cause chain preservation
- "Log or throw, but not both" principle

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

`calculateAllMetrics` is the single entry point for budget metric calculations. It delegates to:

- `calculateTotalIncome` — income with envelope logic + kind filter
- `calculateTotalExpenses` — expenses/savings with envelope logic + kind filter
- `calculateTotalSavings` — savings with envelope logic + free saving transactions

All use the same rule: for each budget line, `effective = max(line.amount, consumed)` where consumed only counts transactions matching the line's kind category (income vs outflow). Free transactions (no `budgetLineId`) are added separately. This ensures:
1. Allocated transactions are never double-counted
2. A misallocated transaction (e.g., income tx on an expense line) doesn't inflate the wrong total
3. `totalSavings` includes both envelope-covered savings and free saving transactions

Backend, frontend, and iOS all delegate to this shared logic (iOS has a Swift port with identical semantics).

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

- API types and DTOs
- Form validation schemas
- Business enums
- Shared calculators

### What to Exclude

- Database types
- Backend implementation
- Frontend UI types

### ESM Requirements

Exports use `.js` extension for Node.js ESM compatibility:

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

- Frontend: `*.spec.ts` in same directory
- Backend: `*.spec.ts` in same directory or `__tests__/`
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

Located in `frontend/projects/webapp/src/app/testing/`:

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

- OnPush change detection (90% reduction in cycles)
- Signal-based state (no zone.js overhead)
- Lazy loading for all features

### Backend

- Bun runtime (3x faster I/O than Node.js)
- Connection pooling via Supabase
- User-based rate limiting (1000 req/min)

---

*See `techContext.md` for technical decisions.*
*See `INFRASTRUCTURE.md` for deployment details.*
