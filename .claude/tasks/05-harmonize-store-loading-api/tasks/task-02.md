# Task: Replace hasError with hasValue in BudgetDetailsStore

## Problem

Le `BudgetDetailsStore` expose `hasError` (logique inversée) au lieu de `hasValue` (pattern Angular idiomatique). Cela crée une incohérence avec les autres stores et force les composants à utiliser la double négation `!hasError()`.

## Proposed Solution

Remplacer `hasError` par `hasValue` en utilisant le type guard natif du resource. Mettre à jour les composants et tests qui utilisent `hasError`.

## Dependencies

- Aucune (peut démarrer immédiatement)

## Context

- Fichier: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
- L64: `readonly hasError = computed(() => !!this.#budgetDetailsResource.error());`
- **Breaking change**: Rechercher tous les usages de `hasError` avant modification

## Success Criteria

- `hasError` remplacé par `hasValue`
- Tous les composants consommateurs mis à jour
- Tests mis à jour avec logique inversée
- `pnpm quality` passe
