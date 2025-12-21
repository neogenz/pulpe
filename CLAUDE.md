# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                      # Full stack (recommended)
pnpm quality                  # BEFORE commit: type-check + lint + format
pnpm test                     # All unit tests
pnpm test:e2e                 # E2E tests (Playwright)

# Single tests
cd frontend && pnpm test -- path/to/file.spec.ts
cd frontend && pnpm test:watch                      # Watch mode
cd backend-nest && bun test path/to/file.test.ts   # Backend single test

# Supabase local
supabase start                # Start local Supabase (DB + Auth)
supabase stop                 # Stop local services
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

## Rules Files

Rules in `.claude/rules/` use frontmatter for path-based activation:

```yaml
---
description: Brief description
paths: "**/*.ts"
---
```

## Architecture References

| Topic | Reference |
|-------|-----------|
| Frontend patterns | @frontend/CLAUDE.md |
| Backend patterns | @backend-nest/CLAUDE.md |
| Business specs | @memory-bank/SPECS.md |

## Critical Rules

> Detailed rules in sub-CLAUDE.md files. This section: cross-cutting concerns only.

- **NEVER** destructive Supabase commands (`db reset`, `db push --force`)
- **ALWAYS** run `pnpm quality` before committing
- **AFTER** DB schema changes: `bun run generate-types:local` in backend

## Vocabulary

- `budget_lines` → "prévisions" | `fixed` → "Tous les mois" | `one_off` → "Une seule fois"
- `income` → "Revenu" | `expense` → "Dépense" | `saving` → "Épargne"
- Labels: "Disponible à dépenser", "Épargne prévue", "Fréquence"

## Key Files
- DB types: `backend-nest/src/types/database.types.ts`
- Shared schemas: `shared/schemas.ts`
