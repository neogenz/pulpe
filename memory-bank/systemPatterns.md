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
├── shared/           # Zod schemas, types (build before other packages)
└── .claude/          # AI context and rules
```

---

## Frontend Architecture

### 5-Layer Pattern

Located in `frontend/projects/webapp/src/app/`:

| Layer | Purpose | Loading |
|-------|---------|---------|
| `core/` | Services, guards, interceptors | Eager |
| `layout/` | App shell components | Eager |
| `ui/` | Stateless reusable components | Cherry-picked |
| `feature/` | Business domains (isolated) | Lazy |
| `pattern/` | Stateful reusable components | Imported |

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

### Module Structure

Each domain in `src/modules/[domain]/`:

```
[domain]/
├── controller.ts     # HTTP routes + validation
├── service.ts        # Business logic
├── mapper.ts         # DTO ↔ Entity transformation
├── dto/              # NestJS DTOs (createZodDto from shared)
└── entities/         # Business entities
```

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
Frontend DTO (Zod) → Backend DTO (createZodDto) → Service → Supabase Client → RLS → PostgreSQL
```

### Key Calculations

```
Available = Income + Rollover (from previous month)
Remaining = Available - Expenses
Ending Balance = Remaining (becomes next month's rollover)
```

---

## Shared Package (pulpe-shared)

Single source of truth for API contracts:

**Include**:
- API types
- Form validation schemas
- Enums

**Exclude**:
- Database types
- Backend implementation
- Frontend UI types

```typescript
// Frontend usage
import { budgetCreateSchema, type BudgetCreate } from 'pulpe-shared';

// Backend usage
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
- Backend: `*.test.ts` in same directory
- E2E: `e2e/**/*.spec.ts`

---

## Naming Conventions

### Files

- Components: `kebab-case.component.ts`
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
