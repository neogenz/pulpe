# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo

```
├── frontend/         # Angular webapp
├── backend-nest/     # NestJS API
├── ios/              # iOS native app (SwiftUI)
├── landing/          # Landing page (Next.js)
├── shared/           # Zod schemas, types (build before other packages)
└── .claude/rules/    # Lazy-loaded rules (00-architecture/ through 08-other/)
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
| Frontend | Angular 21+, Signals, Material 21, Tailwind v4 |
| Backend | NestJS 11+, Bun, Supabase (PostgreSQL + Auth) |
| iOS | SwiftUI, Xcode |
| Landing | Next.js, Tailwind v4 |
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
- **ALWAYS** write `0` to plaintext amount columns (`amount`, `target_amount`, `ending_balance`) and the real encrypted value to `*_encrypted` when `clientKey` is present. Demo mode (no clientKey) writes real values to plaintext. (see `docs/ENCRYPTION.md`)

## Vocabulary

- `budget_lines` → "prévisions" | `fixed` → "Récurrent" | `one_off` → "Prévu" | `transaction` → "Réel"
- `income` → "Revenu" | `expense` → "Dépense" | `saving` → "Épargne"
- Labels: "Disponible à dépenser", "Épargne prévue", "Fréquence"

## Further Reading

**IMPORTANT:** Before starting any task, read the relevant docs below.

| Purpose | Path |
|---------|------|
| DB types | `backend-nest/src/types/database.types.ts` |
| Shared schemas | `shared/schemas.ts` |
| Project overview | `memory-bank/projectbrief.md` |
| Business rules | `memory-bank/productContext.md` |
| Tech decisions | `memory-bank/techContext.md` |
| Architecture | `memory-bank/systemPatterns.md` |
| Encryption (AES-256-GCM) | `docs/ENCRYPTION.md` |

## Bug Reporting

When I report a bug, don't start by trying to fix it. Instead, start by writing a test that reproduces the bug. Then, have subagents try to fix the bug and prove it with a passing test.
