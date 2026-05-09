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

| Purpose                       | Path                                       |
| ----------------------------- | ------------------------------------------ |
| Strategic foundation          | `PRODUCT.md`                               |
| Visual common (cross-platform DA) | `DESIGN.md`                            |
| iOS visual extensions         | `ios/DESIGN.md` (+ `ios/.impeccable/design.json` sidecar) |
| Webapp visual extensions      | `frontend/DESIGN.md` *(seed)*              |
| Landing visual extensions     | `landing/DESIGN.md` *(seed)*               |
| DB types                      | `backend-nest/src/types/database.types.ts` |
| Shared schemas                | `shared/schemas.ts`                        |
| Project overview              | `memory-bank/projectbrief.md`              |
| Business rules                | `memory-bank/productContext.md`            |
| Tech decisions                | `memory-bank/techContext.md`               |
| Architecture                  | `memory-bank/systemPatterns.md`            |
| Backend Clean Architecture    | `backend-nest/docs/ARCHITECTURE.md`        |
| Encryption (AES-256-GCM)      | `docs/ENCRYPTION.md`                       |

**Design doc hierarchy:** `PRODUCT.md` (strategic) → `DESIGN.md` (cross-platform visual common) → per-platform `{ios,frontend,landing}/DESIGN.md` (extensions). Each DESIGN.md links to its parent and siblings; never duplicate cross-platform rules in a platform doc.

## Scope Discipline (read every turn)

Solo project, AI-assisted. The cost of cleanup after over-shipped features is the #1 productivity tax. Every AI turn must respect:

1. **Smallest diff that solves the asked task.** Period. No speculative features, no "while I'm here" refactors, no abstractions invented for hypothetical reuse.
2. **Reuse over create.** Read 3+ existing files first (per Workflow Rule below). Existing component / token / helper > new file every time.
3. **Extract at 3+ identical uses, not 1-2.** A premature helper costs more than three similar lines.
4. **Tests = bug repro + happy path.** No exhaustive coverage unless asked.
5. **Out-of-scope work goes in one block at the end of the response, under the heading `### Follow-up suggestions`.** Do NOT do it. Do NOT re-mention it after that section. The user will scan and decide.
6. **No "follow-up" lists in commits, PR descriptions, or documentation.** They belong in the response only. Code-tree must be self-explanatory.
7. **If your solution exceeds ~300 net LOC, pause and report 2-3 alternatives** before continuing. Do not silently expand.

**Anti-patterns that bypass these rules:**
- Spawning a subagent with a prompt that re-opens scope ("add tests for everything", "consider follow-ups", "extend if needed").
- Generating new docs, configs, or tooling files when the asked task could be solved with an edit to existing files.
- Creating speculative abstractions ("this might be reused later"). It won't.

These rules apply to the main agent and every spawned subagent. CLAUDE.md is **advisory, not enforced** — the responsibility to honor it sits with whoever is generating the response, every turn.

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