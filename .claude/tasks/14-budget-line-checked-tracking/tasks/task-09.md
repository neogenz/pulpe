# Task: Store Integration - Connexion UI/API avec optimistic update

## Problem

Les outputs checkbox des composants UI ne sont pas connectés à l'API backend. Il faut implémenter la logique de state management pour appeler l'API et mettre à jour l'état local de manière optimiste.

## Proposed Solution

Ajouter une méthode `checkBudgetLine` dans les stores (budget-details et current-month) qui implémente un optimistic update : mise à jour immédiate de l'UI, appel API en arrière-plan, rollback si erreur.

## Dependencies

- Task #4: Backend API (endpoint disponible)
- Task #5: Frontend Data Layer (API client)
- Task #6: Budget-table Checkbox (output à connecter)
- Task #8: Current-month Checkbox (output à connecter)

## Context

- Budget-details store: `frontend/.../budget/budget-details/store/`
- Current-month store: `frontend/.../current-month/store/`
- Pattern mutations existantes: suivre `updateBudgetLine`, `deleteBudgetLine`
- API client: méthode `checkBudgetLine(id, checked)` de Task #5

## Success Criteria

- Store budget-details: méthode `checkBudgetLine(id, checked)` avec optimistic update
- Store current-month: même pattern
- UI se met à jour immédiatement au clic
- Rollback visible si erreur API
- Message d'erreur approprié si échec
- Parent components (budget-details.ts, current-month.ts) connectés aux outputs
- Tests unitaires pour la logique optimistic update
