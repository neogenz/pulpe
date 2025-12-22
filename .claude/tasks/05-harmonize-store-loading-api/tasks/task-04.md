# Task: Replace dashboardStatus with standard signals in CurrentMonthStore

## Problem

Le `CurrentMonthStore` expose `dashboardStatus` qui retourne le `ResourceStatus` complet au lieu des signals standards. Les composants doivent comprendre les 6 états possibles au lieu d'utiliser des booleans simples.

## Proposed Solution

Remplacer `dashboardStatus` par les 3 signals standards (`isLoading`, `hasValue`, `error`). Mettre à jour les composants et méthodes internes qui utilisent `dashboardStatus`.

## Dependencies

- Aucune (peut démarrer immédiatement)

## Context

- Fichier: `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`
- L109: `readonly dashboardStatus = computed(() => this.#dashboardResource.status());`
- L165: Utilise `this.dashboardStatus() !== 'loading'`
- **Breaking change**: Rechercher tous les usages de `dashboardStatus` avant modification

## Success Criteria

- `dashboardStatus` supprimé
- 3 signals standards ajoutés: `isLoading`, `hasValue`, `error`
- Tous les composants consommateurs mis à jour
- Tests mis à jour
- `pnpm quality` passe
