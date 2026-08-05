# CLAUDE.md - Shared

```bash
pnpm run build       # clean + build:esm
pnpm run test        # vitest run
pnpm run test:watch  # watch mode
```

Turbo already orders the build (`quality` has `dependsOn: ["^build"]`) — build shared by
hand only when running a package's script outside turbo.

- `index.ts` — package entry point
- `schemas.ts` — Zod schemas, single source of truth for API contracts
- `src/calculators/` — budget formulas, mirrored in `ios/Pulpe/Domain/Formulas/`
- `src/currency.ts`, `src/currency-format.ts` — supported currencies and their formatting
- `src/error-codes.ts`, `src/feature-flags.ts`, `src/http-headers.ts` — shared constants

Schema conventions live in `.claude/rules/03-frameworks-and-libraries/shared-schemas.md`,
which loads on every file here.
