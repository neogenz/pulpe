# CLAUDE.md

**CRITICAL**: YAGNI + KISS - Modern project, 1 developer.

## Commands

```bash
pnpm dev              # Full stack (recommended)
pnpm quality          # BEFORE commit: type-check + lint + format
pnpm test:e2e         # E2E tests (Playwright)
```

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Angular 20+, Signals, Material v20, Tailwind v4 |
| Backend | NestJS 11+, Bun, Supabase (PostgreSQL + Auth) |
| Shared | TypeScript strict, Zod schemas |

## Monorepo

```
├── frontend/         # Angular webapp → @frontend/CLAUDE.md
├── backend-nest/     # NestJS API → @backend-nest/CLAUDE.md
├── shared/           # Zod schemas, types
└── .claude/rules/    # Lazy-loaded rules (frontend/, testing/, shared/)
```

## Architecture References

- **Frontend patterns**: @frontend/CLAUDE.md
- **Backend patterns**: @backend-nest/CLAUDE.md
- **Signal/Store**: @frontend/STATE-PATTERN.md
- **Business specs**: @memory-bank/SPECS.md

## Critical Rules

### Backend (NestJS)
- **NEVER** use `any` types
- **ALWAYS** use Zod for validation
- **NEVER** destructive Supabase commands (`db reset`)
- **AFTER** schema changes: `bun run generate-types:local`

### Frontend/Testing
- See @frontend/CLAUDE.md and @.claude/rules/

## Vocabulary

| Technical | User-facing |
|-----------|-------------|
| `budget_lines` | **"prévisions"** |
| `fixed` | "Tous les mois" |
| `one_off` | "Une seule fois" |
| `income` | "Revenu" |
| `expense` | "Dépense" |
| `saving` | "Épargne" |

**Labels**: "Disponible à dépenser", "Épargne prévue", "Fréquence"

## Auth Flow

Frontend (Supabase SDK) → Backend (JWT validation) → Database (RLS policies)

## Key Files
- DB types: @backend-nest/src/types/database.types.ts
- Shared schemas: @shared/schemas.ts
