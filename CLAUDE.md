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

# Quality — racine uniquement (aucun package ne définit `quality` sauf backend-nest)
pnpm quality                  # turbo quality + format:check:automation + test:ci-security + test:public-surface
                              # lefthook le lance déjà en pre-commit, mais scopé `--filter="...[HEAD^]"` et SKIPPÉ sur merge/rebase
                              # les templates Angular (strictTemplates) ne sont vérifiés que par `ng build` → job CI dédié

# Testing
pnpm test                     # All unit tests
pnpm test:e2e                 # E2E tests (Playwright)

# Single package commands
cd frontend && pnpm exec ng test --include "**/foo.spec.ts"   # Scoped run — `pnpm test -- …` ne passe PAS l'argument
cd frontend && pnpm test:watch                      # Watch mode
cd backend-nest && bun test path/to/file.spec.ts   # Backend single test

# Supabase local (le projet vit dans backend-nest/, pas à la racine)
cd backend-nest && supabase start   # Start local Supabase (DB + Auth)
cd backend-nest && supabase stop    # Stop local services
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
| Frontend      | Angular 22+, Signals, Material 22, Tailwind v4 |
| Backend       | NestJS 11+, Bun, Supabase (PostgreSQL + Auth)  |
| iOS           | SwiftUI, Xcode                                 |
| Landing       | Next.js, Tailwind v4                           |
| Shared        | TypeScript strict, Zod schemas                 |
| Orchestration | pnpm workspaces + Turborepo                    |

## Critical Rules

- **NEVER** destructive Supabase cmds (`db reset`, `db push --force`)
- **AFTER** DB schema change: `bun run generate-types:local` in backend
- **ALWAYS** encrypt financial amounts (`amount`, `target_amount`, `ending_balance`) via `ENCRYPTION_PORT` before DB write. Columns `text` holding AES-256-GCM ciphertexts. (see `docs/ENCRYPTION.md`)
- **ALWAYS** mirror a formula change across both sides: `shared/src/calculators/` ↔ `ios/Pulpe/Domain/Formulas/`, tests included, same commit. Nothing fails the build when they diverge — web and iOS just show two different amounts. (see `.claude/rules/00-architecture/formula-mirrors-ts-swift.md`)

## Vocabulary

- `budget_line` (table ; `budgetLines` sur le wire) → "prévisions" | `fixed` → "Récurrent" | `one_off` → "Prévu" | `transaction` → "Réel"
- `income` → "Revenu" | `expense` → "Dépense" | `saving` → "Épargne"
- `checked` → "Pointé" | `unchecked` → "À pointer"
- Labels: "Disponible à dépenser", "Épargne prévue", "Fréquence"

## Further Reading

**IMPORTANT:** Before any task, read relevant docs below.

| Purpose                       | Path                                       |
| ----------------------------- | ------------------------------------------ |
| Strategic foundation          | `PRODUCT.md`                               |
| Visual common (cross-platform DA) | `DESIGN.md`                            |
| iOS visual extensions         | `ios/DESIGN.md` (no sidecar — `/impeccable live` is browser-only) |
| Webapp visual extensions      | `frontend/DESIGN.md` *(seed)*              |
| Landing visual extensions     | `landing/DESIGN.md` *(seed)*               |
| DB types                      | `backend-nest/src/types/database.types.ts` |
| Shared schemas                | `shared/schemas.ts`                        |
| Project overview              | `aidd_docs/memory/project-brief.md`        |
| Business rules                | `docs/BUSINESS_RULES.md`                   |
| Architecture                  | `aidd_docs/memory/architecture.md`         |
| Backend Clean Architecture    | `backend-nest/docs/ARCHITECTURE.md`        |
| Encryption (AES-256-GCM)      | `docs/ENCRYPTION.md`                       |
| Lissage d'une dépense (PUL-17)| `docs/SPREAD.md`                           |
| Objectifs d'épargne           | `docs/SAVINGS.md`                          |

**Design doc hierarchy:** `PRODUCT.md` (strategic) → `DESIGN.md` (cross-platform visual common) → per-platform `{ios,frontend,landing}/DESIGN.md` (extensions). Each DESIGN.md links to its parent and siblings; never duplicate cross-platform rules in a platform doc.

## Scope Discipline (read every turn)

Solo project, AI-assisted. The cost of cleanup after over-shipped features is the #1 productivity tax. Every AI turn must respect:

1. **Smallest diff that solves the asked task.** Period. No speculative features, no "while I'm here" refactors, no abstractions invented for hypothetical reuse.
2. **Reuse over create.** Read 3+ existing files first — un fichier similaire, et la définition de tout import dont l'API n'est pas certaine. Existing component / token / helper > new file every time.
3. **Extract at 3+ identical uses, not 1-2.** A premature helper costs more than three similar lines.
4. **Tests = bug repro + happy path.** No exhaustive coverage unless asked. Un bug rapporté commence par un test qui le reproduit, avant tout correctif.
5. **Déléguer à un subagent seulement pour un travail large et réellement parallélisable.** Jamais pour vérifier son propre travail. Un agent plutôt que plusieurs quand un seul suffit.
6. **Out-of-scope work goes in one block at the end of the response, under the heading `### Follow-up suggestions`.** Do NOT do it. Do NOT re-mention it after that section. The user will scan and decide.
7. **No "follow-up" lists in commits, PR descriptions, or documentation.** They belong in the response only. Code-tree must be self-explanatory.
8. **If your solution exceeds ~300 net LOC, pause and report 2-3 alternatives** before continuing. Do not silently expand.

**Anti-patterns that bypass these rules:**
- Spawning a subagent with a prompt that re-opens scope ("add tests for everything", "consider follow-ups", "extend if needed").
- Generating new docs, configs, or tooling files when the asked task could be solved with an edit to existing files.
- Creating speculative abstractions ("this might be reused later"). It won't.

These rules apply to the main agent and every spawned subagent. CLAUDE.md is **advisory, not enforced** — the responsibility to honor it sits with whoever is generating the response, every turn.

## Memory Management

Project docs, memory, specs, and plans live in `aidd_docs/`.

### Project memory

<aidd_project_memory>
@aidd_docs/memory/api.md
@aidd_docs/memory/architecture.md
@aidd_docs/memory/auth.md
@aidd_docs/memory/codebase-map.md
@aidd_docs/memory/coding-assertions.md
@aidd_docs/memory/database.md
@aidd_docs/memory/deployment.md
@aidd_docs/memory/design.md
@aidd_docs/memory/forms.md
@aidd_docs/memory/integration.md
@aidd_docs/memory/mobile.md
@aidd_docs/memory/navigation.md
@aidd_docs/memory/package.md
@aidd_docs/memory/project-brief.md
@aidd_docs/memory/testing.md
@aidd_docs/memory/vcs.md
</aidd_project_memory>

- If the block above is empty, run `ls -1tr aidd_docs/memory/` and read each file.
- Load `aidd_docs/memory/external/*` when the user asks.
- Load `aidd_docs/memory/internal/*` when the task needs it.
