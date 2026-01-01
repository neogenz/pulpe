# Task: Frontend Data Layer - Models et Services

## Problem

Le frontend n'a pas les types, modèles et services nécessaires pour gérer l'état "coché" des lignes budgétaires. Il faut préparer la couche données avant de pouvoir implémenter l'UI.

## Proposed Solution

Mettre à jour les modèles frontend pour inclure les propriétés `isChecked` et `checkedAt`, ajouter la méthode API client pour appeler l'endpoint `/check`, et exposer le calcul du solde réalisé.

## Dependencies

- Task #3: Budget Formulas (calcul solde réalisé)
- Task #4: Backend API (endpoint disponible)

## Context

- API client: localiser dans `frontend/projects/webapp/src/app/core/`
- Models: `frontend/.../budget-table/budget-table-models.ts` (lignes 31-45)
- Data provider: `frontend/.../budget-table/budget-table-data-provider.ts`
- Calculator: `frontend/projects/webapp/src/app/core/budget/budget-calculator.ts`
- Pattern metadata: `isLoading`, `isRollover` dans `TableItem.metadata`

## Success Criteria

- `TableItem.metadata` étendu avec `isChecked?: boolean` et `checkedAt?: string | null`
- API client: méthode `checkBudgetLine(id: string, checked: boolean)` ajoutée
- Data provider: mapping `checkedAt` → `metadata.isChecked` et `metadata.checkedAt`
- Calculator: méthode `calculateRealizedBalance(budgetLines)` qui délègue à `BudgetFormulas`
- Build frontend réussit
