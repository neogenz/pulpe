# Tasks: Transactions Allouées aux Prévisions Budgétaires

## Overview

Feature permettant d'associer optionnellement une transaction à une ligne budgétaire (BudgetLine) pour suivre précisément la consommation par enveloppe (Essence, Repas, etc.). L'implémentation est additive et backward-compatible.

## Task List

### Phase Backend

- [ ] **Task 1**: Migration DB + Shared Schemas - `task-01.md`
- [ ] **Task 2**: Validation Backend Transaction Allouée - `task-02.md` (dépend de Task 1)
- [ ] **Task 3**: Calculs Métier BudgetLine - `task-03.md` (dépend de Task 1)
- [ ] **Task 4**: API Endpoints Enrichis - `task-04.md` (dépend de Tasks 2 et 3)

### Phase Frontend

- [ ] **Task 5**: Frontend API Service + Store - `task-05.md` (dépend de Task 4)
- [ ] **Task 6**: AllocatedTransactionsDialog (Affichage) - `task-06.md` (dépend de Task 5)
- [ ] **Task 7**: AllocatedTransactionFormDialog - `task-07.md` (dépend de Task 6)
- [ ] **Task 8**: CRUD Actions + Store Optimistic Updates - `task-08.md` (dépend de Task 7)

### Phase Tests

- [ ] **Task 9**: Tests E2E Playwright - `task-09.md` (dépend de Task 8)

## Execution Order

```
Task 1 (Migration + Schemas)
    ├── Task 2 (Validation Backend)  ──┐
    └── Task 3 (Calculs Métier)     ──┴── Task 4 (API)
                                              │
                                        Task 5 (Frontend API/Store)
                                              │
                                        Task 6 (Dialog Affichage)
                                              │
                                        Task 7 (Form Dialog)
                                              │
                                        Task 8 (CRUD + Optimistic)
                                              │
                                        Task 9 (E2E Tests)
```

### Parallélisation possible

- **Tasks 2 et 3** peuvent être faites en parallèle après Task 1
- Les autres tâches sont séquentielles

## Estimation

| Phase | Tasks | Durée estimée |
|-------|-------|---------------|
| Backend | 1-4 | ~4 jours |
| Frontend | 5-8 | ~4 jours |
| E2E | 9 | ~1 jour |
| **Total** | 9 | **~9 jours** |

## Notes

- Chaque tâche est conçue pour ~1-2 heures de travail
- Les tests unitaires sont inclus dans chaque tâche (pas de tâche séparée)
- Task 9 (E2E) valide l'intégration complète
