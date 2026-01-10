# Tasks: 27 - Global Transaction Search

## Overview

Implémenter une recherche textuelle globale dans toutes les transactions de tous les budgets. La fonctionnalité permet à l'utilisateur de rechercher par nom ou description de transaction, avec affichage des résultats incluant un breadcrumb année/mois, et navigation vers le budget concerné.

## Task List

- [ ] **Task 1**: Add TransactionSearchResult Schema - `task-01.md`
- [ ] **Task 2**: Backend Search Implementation - `task-02.md` (depends on Task 1)
- [ ] **Task 3**: Frontend Transaction API Search Method - `task-03.md` (depends on Task 1)
- [ ] **Task 4**: Frontend Search Transactions Dialog Component - `task-04.md` (depends on Task 3)
- [ ] **Task 5**: Frontend Budget List Page Integration - `task-05.md` (depends on Task 4)

## Execution Order

```
Task 1 (Shared Schema)
    │
    ├──→ Task 2 (Backend) ──────────────┐
    │                                    │
    └──→ Task 3 (Frontend API) ──→ Task 4 (Dialog) ──→ Task 5 (Integration)
```

**Parallel possibilities:**
- Tasks 2 and 3 can be developed in parallel after Task 1
- Task 2 must be deployed before Task 4 can be E2E tested

## Estimated Time

| Task | Estimated Duration |
|------|-------------------|
| Task 1 | 15-20 min |
| Task 2 | 45-60 min |
| Task 3 | 15-20 min |
| Task 4 | 45-60 min |
| Task 5 | 20-30 min |
| **Total** | **~2.5-3 hours** |

## Recommended Start

1. **Start with Task 1** - Foundation for all other tasks
2. Then either:
   - **Task 2** (backend) if you want full-stack integration testing early
   - **Task 3** (frontend API) if you want to mock backend and focus on UI first
