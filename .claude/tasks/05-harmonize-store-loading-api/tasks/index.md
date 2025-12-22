# Tasks: Harmonize Store Loading/Error API

## Overview

Standardiser l'API loading/error de tous les stores sur l'API native Angular `resource()`:
- `isLoading: Signal<boolean>`
- `hasValue: Signal<boolean>` (type guard)
- `error: Signal<Error | null>`

## Task List

- [ ] **Task 1**: Add hasValue to TemplateDetailsStore - `task-01.md`
- [ ] **Task 2**: Replace hasError with hasValue in BudgetDetailsStore - `task-02.md`
- [ ] **Task 3**: Add standard signals to BudgetListStore - `task-03.md`
- [ ] **Task 4**: Replace dashboardStatus in CurrentMonthStore - `task-04.md`
- [ ] **Task 5**: Refactor TemplateLineStore (private signals) - `task-05.md`
- [ ] **Task 6**: Align remaining stores (Onboarding, Template, Auth) - `task-06.md`

## Execution Order

**Toutes les tâches sont indépendantes** et peuvent être exécutées en parallèle.

Cependant, l'ordre recommandé par complexité croissante:

1. **Tasks 1, 3** (ajouts simples, pas de breaking change)
2. **Tasks 2, 4, 6** (breaking changes, nécessitent mise à jour des consommateurs)
3. **Task 5** (refactoring plus important)

## Breaking Changes

| Task | Signal renommé/supprimé | Impact |
|------|------------------------|--------|
| Task 2 | `hasError` → `hasValue` | Composants budget-details |
| Task 4 | `dashboardStatus` supprimé | Composants current-month |
| Task 6 | `isSubmitting`, `isLoadingTemplates` | Composants onboarding, create-budget |

## Validation

Après chaque tâche:
```bash
cd frontend && pnpm test -- <store>.spec.ts
pnpm quality
```

Après toutes les tâches:
```bash
pnpm test:e2e
```
