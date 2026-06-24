# CLAUDE.md - Backend (NestJS)

## Commands

```bash
bun run dev                    # Start with local Supabase (port 3000)
bun run build                  # Production build
bun test                       # Run all tests
bun test path/to/file.test.ts  # Single test file
bun run quality                # Type-check + Lint + Format
bun run generate-types:local   # Generate types from local Supabase
```

**BEFORE committing**: Run `bun run quality`
**AFTER schema changes**: Run `bun run generate-types:local`

## Module Structure

3-layer Clean Architecture per module (`infrastructure → application → domain`). Full details: `docs/ARCHITECTURE.md`.

```
src/modules/[domain]/
├── domain/             # Entities, invariants, ports (Symbol tokens) — pure TS
├── application/        # *.use-case.ts — @Injectable, single execute()
├── infrastructure/     # http/ (controller, dto), persistence/ (repository, RPC schemas), mappers/
├── [domain].module.ts
└── [domain].tokens.ts  # Public port re-exports
```

Business logic lives in `application/*.use-case.ts`, **not** a service. Cross-module = ports + Symbol tokens only (never direct service imports).

## Data Flow

```
Frontend (Zod) → Controller → Use Case → Repository → Database (RLS)
DB Row (snake_case) → Repository (decrypt) → Mapper → API Response (camelCase)
```

Repositories own the encryption boundary (encrypt on write / decrypt on read via `ENCRYPTION_PORT`); use cases see plain numbers.

## Key Tables

- `monthly_budget` - User budgets by month/year
- `transaction` - Financial transactions
- `template` - Budget templates (public + private)
- `template_line` - Template transaction items

## Testing

- Mock Supabase client `createMockSupabaseClient()`
- Test use cases, repositories, guards independent
- Swagger docs: `http://localhost:3000/docs`

## Critical Rules

- **NEVER** `any` types
- **ALWAYS** Zod for external data validation
- **ALWAYS** mappers for DTO ↔ Entity transformation
- **NEVER** expose DB types in API responses
- **NEVER** log sensitive data
- **AFTER** schema changes: regenerate types