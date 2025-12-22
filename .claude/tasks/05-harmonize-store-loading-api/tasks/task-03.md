# Task: Add standard loading/error signals to BudgetListStore

## Problem

Le `BudgetListStore` expose le resource `budgets` directement sans wrapper computed pour `isLoading`, `hasValue`, `error`. Les composants doivent accéder à `.status()` directement, ce qui est incohérent avec les autres stores.

## Proposed Solution

Ajouter les 3 computed signals standards (`isLoading`, `hasValue`, `error`) qui délèguent au resource. Utiliser ces signals dans les méthodes internes.

## Dependencies

- Aucune (peut démarrer immédiatement)

## Context

- Fichier: `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-store.ts`
- L26-29: Le resource `budgets` est défini
- L154: Utilise `this.budgets.status() !== 'loading'` directement
- Aucun breaking change attendu (ajout uniquement)

## Success Criteria

- 3 signals ajoutés: `isLoading`, `hasValue`, `error`
- L154 mis à jour pour utiliser `!this.isLoading()`
- Tests ajoutés pour les nouveaux signals
- `pnpm quality` passe
