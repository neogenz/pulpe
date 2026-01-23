# Pulpe - System Architecture

## Executive Summary

**System Purpose**: Personal budget management for the Swiss market using reusable monthly templates with automatic rollover.

**Philosophy**: Planning > Tracking, Simplicity > Completeness (KISS & YAGNI), Isolation > DRY

**Tech Stack**:
- Frontend: Angular 21 (Standalone + Signals), Tailwind v4, Material 21
- Backend: NestJS 11 (Bun runtime)
- Database: Supabase (PostgreSQL + Auth + RLS)
- Shared: Zod schemas (pulpe-shared)

## Monorepo Structure

See root `CLAUDE.md` for complete structure and commands.

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

**Dependency Rules**: `core ← layout, feature, pattern` | `ui ← layout, feature, pattern` | `pattern ← feature` | Features isolated (no sibling imports)

### Key Patterns
- Standalone components (no NgModules)
- OnPush + Signals for performance
- Features as isolated "black boxes"

### Demo Mode
- `DemoModeService`: Signal-based state (localStorage sync)
- `DemoInitializerService`: API call + Supabase auth setup
- UI: Welcome screen + login page demo buttons

## Backend Architecture

### Module Structure

Each domain in `src/modules/[domain]/`:
- `controller.ts` → HTTP routes + validation
- `service.ts` → Business logic
- `mapper.ts` → DTO ↔ Entity transformation
- `dto/` → NestJS DTOs (createZodDto from shared)
- `entities/` → Business entities

### Authentication & Security
- JWT via Supabase Auth
- AuthGuard with `@User()` and `@SupabaseClient()` decorators
- RLS policies enforce data isolation at DB level
- Zero Trust: All endpoints protected by default

### Demo Mode System
- Ephemeral users with `is_demo: true` metadata
- Auto-cleanup cron every 6h (24h retention)
- `@DevOnly()` guard for manual cleanup endpoint

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

### Key Features
- Automatic rollover: Monthly surplus/deficit propagation
- Template system: Reusable budget structures
- Financial calculations: Server-side computed values

## pulpe-shared Package

Single source of truth for API contracts:
- **Include**: API types, form validation schemas, enums
- **Exclude**: Database types, backend implementation, frontend UI types

```typescript
// Frontend
import { budgetCreateSchema, type BudgetCreate } from 'pulpe-shared';

// Backend
import { budgetCreateSchema } from 'pulpe-shared';
export class CreateBudgetDto extends createZodDto(budgetCreateSchema) {}
```

## Testing Strategy

- **Unit**: Business logic with mocked dependencies (Vitest)
- **Integration**: API endpoints with real database
- **E2E**: Critical user flows (Playwright)
- **Performance**: Load testing for API endpoints

---

*See `INFRASTRUCTURE.md` for deployment, CI/CD, and monitoring details.*
