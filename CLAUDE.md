# Pulpe Workspace

Monorepo pnpm + Turborepo : `frontend/` (Angular 22, Signals, Material 22, Tailwind v4), `backend-nest/` (NestJS 11, Bun, Supabase), `ios/` (SwiftUI, hors pnpm), `landing/` (Next.js), `shared/` (Zod, build avant les autres), `.claude/rules/` (règles chargées à la demande).

## Commands

```bash
pnpm dev                      # Full stack via Turbo
pnpm build:shared             # shared seul (dépendance des autres)
pnpm dev:frontend             # frontend + shared    (idem dev:backend)
pnpm test                     # Unit tests           (pnpm test:e2e → Playwright)

# Quality — racine uniquement (aucun package ne définit `quality` sauf backend-nest)
pnpm quality                  # turbo quality + format:check:automation + test:ci-security + test:public-surface
                              # lefthook le lance en pre-commit, mais scopé `--filter="...[HEAD^]"` et SKIPPÉ sur merge/rebase
                              # les templates Angular (strictTemplates) ne sont vérifiés que par `ng build` → job CI dédié

# Test unitaire ciblé — `pnpm test -- <path>` ne filtre PAS
cd frontend && pnpm exec ng test --include "**/foo.spec.ts"
cd backend-nest && bun test path/to/file.spec.ts

# Supabase local — le projet vit dans backend-nest/, pas à la racine
cd backend-nest && supabase start
```

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

## Docs

| Purpose                     | Path                                       |
| --------------------------- | ------------------------------------------ |
| Strategic foundation        | `PRODUCT.md`                               |
| Business rules              | `docs/BUSINESS_RULES.md`                   |
| Encryption (AES-256-GCM)    | `docs/ENCRYPTION.md`                       |
| Lissage d'une dépense       | `docs/SPREAD.md`                           |
| Objectifs d'épargne         | `docs/SAVINGS.md`                          |
| Backend Clean Architecture  | `backend-nest/docs/ARCHITECTURE.md`        |
| DB types                    | `backend-nest/src/types/database.types.ts` |
| Shared schemas              | `shared/schemas.ts`                        |

**Design:** `PRODUCT.md` (stratégie) → `DESIGN.md` (visuel cross-platform) → `{ios,frontend,landing}/DESIGN.md` (extensions). Jamais dupliquer une règle cross-platform dans un doc de plateforme. `ios/DESIGN.md` n'a pas de sidecar — `/impeccable live` est browser-only.

## Scope Discipline

Projet solo, assisté IA. Le nettoyage après une feature sur-livrée est la première taxe de productivité.

- **Le hors-scope va dans un bloc unique en fin de réponse, sous le titre `### Follow-up suggestions`.** Ne pas le faire. Ne pas y revenir après cette section. Maxime scanne et décide.
- **Aucune liste de "follow-up" dans un commit, une description de PR, ou la doc.** Elles n'existent que dans la réponse ; l'arbre de code doit se suffire.
- **Au-delà de ~300 LOC nettes, s'arrêter et proposer 2-3 alternatives** avant de continuer.

## Memory Management

Docs, mémoire, specs et plans vivent dans `aidd_docs/`.

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

- `aidd_docs/memory/external/*` : à la demande de l'utilisateur.
- `aidd_docs/memory/internal/*` : quand la tâche l'exige.
