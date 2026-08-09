# Pulpe Workspace

pnpm + Turborepo monorepo: `frontend/` (Angular 22, Signals, Material 22, Tailwind v4), `backend-nest/` (NestJS 11, Bun, Supabase), `ios/` (SwiftUI, outside pnpm), `landing/` (Next.js), `shared/` (Zod, builds before the others), `.claude/rules/` (rules loaded on demand).

## Commands

```bash
pnpm dev                      # Full stack via Turbo
pnpm build:shared             # shared alone (the others depend on it)
pnpm dev:frontend             # frontend + shared    (same for dev:backend)
pnpm test                     # Unit tests           (pnpm test:e2e → Playwright)

# Quality — root only (no package defines `quality` except backend-nest)
pnpm quality                  # turbo quality + format:check:automation + test:ci-security + test:public-surface
                              # lefthook runs it pre-commit, but scoped `--filter="...[HEAD^]"` and SKIPPED on merge/rebase
                              # Angular templates (strictTemplates) are only checked by `ng build` → dedicated CI job

# Single test file — `pnpm test -- <path>` does NOT filter
cd frontend && pnpm exec ng test --include "**/foo.spec.ts"
cd backend-nest && bun test path/to/file.spec.ts

# Local Supabase — the project lives in backend-nest/, not at the root
cd backend-nest && supabase start
```

## Critical Rules

- **NEVER** destructive Supabase cmds (`db reset`, `db push --force`)
- **AFTER** DB schema change: `bun run generate-types:local` in backend
- **ALWAYS** encrypt financial amounts (`amount`, `target_amount`, `ending_balance`) via `ENCRYPTION_PORT` before DB write. Columns `text` holding AES-256-GCM ciphertexts. (see `docs/ENCRYPTION.md`)
- **ALWAYS** mirror a formula change across both sides: `shared/src/calculators/` ↔ `ios/Pulpe/Domain/Formulas/`, tests included, same commit. Nothing fails the build when they diverge — web and iOS just show two different amounts. (see `.claude/rules/00-architecture/formula-mirrors-ts-swift.md`)

## Vocabulary

Product-facing copy is French. Code and docs are English.

- `budget_line` (table; `budgetLines` on the wire) → "prévisions" | `fixed` → "Récurrent" | `one_off` → "Prévu" | `transaction` → "Réel"
- `income` → "Revenu" | `expense` → "Dépense" | `saving` → "Épargne"
- `checked` → "Pointé" | `unchecked` → "À pointer"
- Labels: "Disponible à dépenser", "Épargne prévue", "Fréquence"

## Docs

| Purpose                     | Path                                       |
| --------------------------- | ------------------------------------------ |
| Strategic foundation        | `PRODUCT.md`                               |
| Business rules              | `docs/BUSINESS_RULES.md`                   |
| Encryption (AES-256-GCM)    | `docs/ENCRYPTION.md`                       |
| Spreading an expense        | `docs/SPREAD.md`                           |
| Savings goals               | `docs/SAVINGS.md`                          |
| Backend Clean Architecture  | `backend-nest/docs/ARCHITECTURE.md`        |
| DB types                    | `backend-nest/src/types/database.types.ts` |
| Shared schemas              | `shared/schemas.ts`                        |

**Design:** `PRODUCT.md` (strategy) → `DESIGN.md` (cross-platform visual) → `{ios,frontend,landing}/DESIGN.md` (extensions). Never duplicate a cross-platform rule inside a platform doc. `ios/DESIGN.md` has no sidecar — `/impeccable live` is browser-only.

## Scope Discipline

Solo project, AI-assisted. Cleaning up after an over-shipped feature is the top productivity tax.

- **Out-of-scope work goes in one block at the end of the response, under the heading `### Follow-up suggestions`.** Do not do it. Do not bring it up again after that section. Maxime scans and decides.
- **No "follow-up" list in a commit, a PR description, or the docs.** They exist in the response only; the code tree must stand on its own.
- **Past ~300 net LOC, stop and propose 2-3 alternatives** before continuing.

## Memory Management

Docs, memory, specs and plans live in `aidd_docs/`.

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

- `aidd_docs/memory/external/*`: when the user asks.
- `aidd_docs/memory/internal/*`: when the task needs it.
