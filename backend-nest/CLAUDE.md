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

```
src/modules/[domain]/
├── [domain].controller.ts    # HTTP routes, validation, Swagger docs
├── [domain].service.ts       # Business logic, orchestration
├── [domain].module.ts        # Module configuration, DI setup
├── [domain].mapper.ts        # DTO ↔ Entity transformation
├── dto/                      # Request/Response DTOs with Zod
└── entities/                 # Business entities
```

## Data Flow

```
Frontend (Zod) → Backend DTO → Service → Database (RLS)
DB Row (snake_case) → Mapper → API Response (camelCase)
```

## Key Tables

- `monthly_budget` - User budgets by month/year
- `transaction` - Financial transactions
- `template` - Budget templates (public + private)
- `template_line` - Template transaction items

## Testing

- Mock Supabase client with `createMockSupabaseClient()`
- Test services and guards independently
- Swagger docs: `http://localhost:3000/docs`

## Critical Rules

- **NEVER** use `any` types
- **ALWAYS** use Zod for external data validation
- **ALWAYS** use mappers for DTO ↔ Entity transformation
- **NEVER** expose database types in API responses
- **NEVER** log sensitive data
- **AFTER** schema changes: Regenerate types
