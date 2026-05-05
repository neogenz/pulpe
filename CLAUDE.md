# Pulpe Workspace

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

| Layer         | Tech                                           |
| ------------- | ---------------------------------------------- |
| Frontend      | Angular 21+, Signals, Material 21, Tailwind v4 |
| Backend       | NestJS 11+, Bun, Supabase (PostgreSQL + Auth)  |
| iOS           | SwiftUI, Xcode                                 |
| Landing       | Next.js, Tailwind v4                           |
| Shared        | TypeScript strict, Zod schemas                 |
| Orchestration | pnpm workspaces + Turborepo                    |

## Rules Files

Rules `.claude/rules/` use frontmatter for path activation:

```yaml
---
description: Brief description
paths: "**/*.ts"
---
```

## Critical Rules

- **NEVER** destructive Supabase cmds (`db reset`, `db push --force`)
- **ALWAYS** run `pnpm quality` before commit
- **AFTER** DB schema change: `bun run generate-types:local` in backend
- **ALWAYS** encrypt financial amounts (`amount`, `target_amount`, `ending_balance`) via `EncryptionService` before DB write. Columns `text` holding AES-256-GCM ciphertexts. (see `docs/ENCRYPTION.md`)

## Vocabulary

- `budget_lines` → "prévisions" | `fixed` → "Récurrent" | `one_off` → "Prévu" | `transaction` → "Réel"
- `income` → "Revenu" | `expense` → "Dépense" | `saving` → "Épargne"
- `checked` → "Pointé" | `unchecked` → "À pointer"
- Labels: "Disponible à dépenser", "Épargne prévue", "Fréquence"

## Further Reading

**IMPORTANT:** Before any task, read relevant docs below.

| Purpose                  | Path                                       |
| ------------------------ | ------------------------------------------ |
| DB types                 | `backend-nest/src/types/database.types.ts` |
| Shared schemas           | `shared/schemas.ts`                        |
| Project overview         | `memory-bank/projectbrief.md`              |
| Business rules           | `memory-bank/productContext.md`            |
| Tech decisions           | `memory-bank/techContext.md`               |
| Architecture             | `memory-bank/systemPatterns.md`            |
| Encryption (AES-256-GCM) | `docs/ENCRYPTION.md`                       |

## Bug Reporting

Bug reported → don't fix first. Write test reproducing bug. Then subagents fix, prove with passing test.

## Workflow modification

**CRITICAL RULE•- ALWAYS • FOLLOW• THIS**

**BEFORE editing any files, you MUST Read at least 3 files** to understand coherence + consistency.

**NON-NEGOTIABLE**. Never skip.

Reading existing files ensures:

- Code consistency with project patterns
- Proper convention understanding
- Following established architecture
- Avoiding breaking changes

**File types you MUST read:**

**Similar files**: Files with similar functionality → patterns + conventions
**Imported dependencies**: Definition/implementation of imports you not 100% sure how to use — understand API, types, usage
**Steps:**

1. Read 3+ relevant existing files (similar functionality + imported deps)
2. Understand patterns, conventions, API usage
3. Only then create/edit files