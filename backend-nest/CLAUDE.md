# CLAUDE.md - Backend (NestJS)

## Commands

```bash
bun run dev                    # Start with local Supabase (port 3000)
bun run build                  # Production build
bun test                       # Run all tests
bun test path/to/file.spec.ts  # Single test file
bun run quality                # type-check:full + lint + lint:arch (depcruise) + format:check
bun run generate-types:local   # Generate types from local Supabase
```

`lint:arch` is the gate that enforces the layer rule — a use case importing another
module's service fails there, not in review.

## Architecture

3-layer Clean Architecture per module (`infrastructure → application → domain`), the
encryption boundary, the DTO contract and the logging surface all live in the rules that
load on `backend-nest/**/*.ts`: `nestjs-architecture.md`, `nestjs-api-contracts.md`,
`encryption-backend.md`, `logging.md`, `typescript.md`. Deeper still: `docs/ARCHITECTURE.md`.

## Testing

- Mock Supabase client: `createMockSupabaseClient()` in `src/test/test-mocks.ts`
- Test use cases, repositories, guards independent
- Swagger docs: `http://localhost:3000/docs`

## Tables

The eleven tables are declared in `src/types/database.types.ts` — read them there rather
than from a list that goes stale.
