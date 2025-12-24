# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo

```
├── frontend/         # Angular webapp
├── backend-nest/     # NestJS API
├── shared/           # Zod schemas, types (build before other packages)
└── .claude/rules/    # Lazy-loaded rules (frontend/, testing/, shared/)
```

## Commands

```bash
# Full stack (recommended)
pnpm dev                      # Starts all packages via Turbo

# Quality (BEFORE every commit)
pnpm quality                  # type-check + lint + format (all packages)

# Testing
pnpm test                     # All unit tests
pnpm test:e2e                 # E2E tests (Playwright)

# Single package commands
cd frontend && pnpm test -- path/to/file.spec.ts   # Frontend single test
cd frontend && pnpm test:watch                      # Watch mode
cd backend-nest && bun test path/to/file.test.ts   # Backend single test

# Supabase local
supabase start                # Start local Supabase (DB + Auth)
supabase stop                 # Stop local services
```

### Turbo-Specific Commands

```bash
pnpm build                    # Build all packages (respects deps)
pnpm build:shared             # Build shared only
pnpm dev:frontend             # Frontend + shared
pnpm dev:backend              # Backend + shared
```

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Angular 20+, Signals, Material v20, Tailwind v4 |
| Backend | NestJS 11+, Bun, Supabase (PostgreSQL + Auth) |
| Shared | TypeScript strict, Zod schemas |
| Orchestration | pnpm workspaces + Turborepo |

## Rules Files

Rules in `.claude/rules/` use frontmatter for path-based activation:

```yaml
---
description: Brief description
paths: "**/*.ts"
---
```

## Critical Rules

- **NEVER** destructive Supabase commands (`db reset`, `db push --force`)
- **ALWAYS** run `pnpm quality` before committing
- **AFTER** DB schema changes: `bun run generate-types:local` in backend

## Vocabulary

- `budget_lines` → "prévisions" | `fixed` → "Récurrent" | `one_off` → "Prévu" | `transaction` → "Réel"
- `income` → "Revenu" | `expense` → "Dépense" | `saving` → "Épargne"
- Labels: "Disponible à dépenser", "Épargne prévue", "Fréquence"

## Key Files

| Purpose | Path |
|---------|------|
| DB types | `backend-nest/src/types/database.types.ts` |
| Shared schemas | `shared/schemas.ts` |
| Business specs | `memory-bank/SPECS.md` |
