# CLAUDE.md - Backend (NestJS)

3-layer Clean Architecture per module: `infrastructure → application → domain`.
Full rationale in `docs/ARCHITECTURE.md`; the enforcing rules load automatically on `backend-nest/**/*.ts`.

## Commands

```bash
bun run dev                    # Start with local Supabase (port 3000)
bun run build                  # Production build
bun test path/to/file.spec.ts  # Single test file (bare `bun test` runs all)
bun run quality                # type-check:full + lint + lint:arch (depcruise) + format:check
bun run generate-types:local   # Generate types from local Supabase
```

`lint:arch` is the gate that enforces the layer rule — a use case importing another module's service fails there, not in review.

## Testing

- Mock Supabase client: `createMockSupabaseClient()` in `src/test/test-mocks.ts`
- Swagger docs: `http://localhost:3000/docs`

## Tables

Declared in `src/types/database.types.ts` — read them there rather than from a list that goes stale.
