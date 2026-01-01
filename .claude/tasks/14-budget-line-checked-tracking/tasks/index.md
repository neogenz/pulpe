# Tasks: Suivi des lignes budgétaires réalisées

## Overview

Implémenter la fonctionnalité permettant aux utilisateurs de cocher/décocher leurs lignes budgétaires pour marquer leur réalisation, avec affichage de la date et calcul d'un solde réalisé.

**User Stories couvertes:**
- US-1: Cocher une ligne budgétaire comme réalisée
- US-2: Décocher une ligne budgétaire
- US-3: Afficher la date de réalisation
- US-4: Afficher le solde réalisé dans budget-table
- US-5: Afficher le solde réalisé dans current-month

## Task List

### Foundation Layer

- [ ] **Task 1**: Migration DB - Ajouter colonne checked_at - `task-01.md`
- [ ] **Task 2**: Shared Schema - Ajouter checkedAt au type BudgetLine - `task-02.md` *(depends: Task 1)*

### Business Logic

- [ ] **Task 3**: Budget Formulas - Calcul du solde réalisé - `task-03.md` *(depends: Task 2)*
- [ ] **Task 4**: Backend API - Endpoint PATCH /budget-lines/:id/check - `task-04.md` *(depends: Task 1, 2)*

### Frontend Data

- [ ] **Task 5**: Frontend Data Layer - Models et Services - `task-05.md` *(depends: Task 3, 4)*

### UI Components

- [ ] **Task 6**: Budget-table UI - Checkbox et Styling - `task-06.md` *(depends: Task 5)*
- [ ] **Task 7**: Budget-table UI - Affichage solde réalisé - `task-07.md` *(depends: Task 5, 6)*
- [ ] **Task 8**: Current-month UI - Checkbox et Solde réalisé - `task-08.md` *(depends: Task 5)*

### Integration

- [ ] **Task 9**: Store Integration - Connexion UI/API avec optimistic update - `task-09.md` *(depends: Task 4, 5, 6, 8)*

## Execution Order

```
Task 1 (Migration DB)
    │
    ▼
Task 2 (Shared Schema)
    │
    ├──────────────────┐
    ▼                  ▼
Task 3 (Formulas)   Task 4 (Backend API)
    │                  │
    └────────┬─────────┘
             ▼
         Task 5 (Frontend Data)
             │
    ┌────────┼────────┐
    ▼        │        ▼
Task 6    Task 7    Task 8
(Checkbox) (Balance) (Current-month)
    │        │        │
    └────────┴────────┘
             │
             ▼
         Task 9 (Store Integration)
```

## Parallel Execution Opportunities

1. **Après Task 2**: Tasks 3 et 4 peuvent être faites en parallèle
2. **Après Task 5**: Tasks 6 et 8 peuvent être faites en parallèle
3. **Task 7** peut commencer dès Task 6 terminée (mais a besoin de Task 5)

## Estimated Effort

| Task | Complexity | Est. Time |
|------|------------|-----------|
| Task 1 | Simple | 15 min |
| Task 2 | Simple | 15 min |
| Task 3 | Medium | 45 min |
| Task 4 | Medium | 1h |
| Task 5 | Simple | 30 min |
| Task 6 | Medium | 1h |
| Task 7 | Simple | 30 min |
| Task 8 | Medium | 1h |
| Task 9 | Medium | 1h |

**Total estimé**: ~6-7 heures

## Quick Start

Commencer par **Task 1** (Migration DB) - aucune dépendance.

```bash
# Depuis backend-nest/
supabase migration new add_checked_at_to_budget_line
# Éditer le fichier migration créé
supabase db push
bun run generate-types:local
```
