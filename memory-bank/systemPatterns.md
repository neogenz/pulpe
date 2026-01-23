# Pulpe - System Patterns & Architecture

> Architecture patterns, coding standards, and design principles.

---

## Monorepo Structure

```
pulpe-workspace/
├── frontend/         # Angular webapp
├── backend-nest/     # NestJS API
├── ios/              # iOS native app (SwiftUI)
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

### Core Layer Domains

The `core/` layer contains domain-specific services:

- `auth/` - Authentication, guards, session
- `analytics/` - PostHog tracking
- `budget/` - Budget calculations
- `config/` - App configuration
- `demo/` - Demo mode services
- `routing/` - Route guards, navigation
- `storage/` - LocalStorage, persistence
- `user-settings/` - User preferences

### Feature Domains

Current features in `feature/`:

- `auth/` - Login, signup flows
- `budget/` - Budget overview
- `budget-templates/` - Template management
- `complete-profile/` - Onboarding
- `current-month/` - Main budget view
- `legal/` - Privacy, terms
- `maintenance/` - Maintenance page
- `settings/` - User settings
- `welcome/` - Welcome flow

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

- `auth/` - Authentication endpoints
- `budget/` - Budget CRUD + calculations
- `budget-line/` - Budget line management
- `budget-template/` - Template CRUD
- `demo/` - Demo mode API
- `debug/` - Debug endpoints (dev only)
- `supabase/` - Supabase client
- `transaction/` - Transaction management
- `user/` - User management

### Authentication & Security

- JWT via Supabase Auth
- `AuthGuard` with `@User()` and `@SupabaseClient()` decorators
- RLS policies enforce data isolation at DB level
- Zero Trust: All endpoints protected by default

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
