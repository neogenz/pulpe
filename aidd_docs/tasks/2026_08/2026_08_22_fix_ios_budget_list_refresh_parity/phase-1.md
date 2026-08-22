---
status: done
---

# Instruction: Relier les retours de navigation au cache invalidé

## Architecture projection

```txt
ios/Pulpe/Features/Budgets/BudgetList/BudgetListView.swift
ios/PulpeTests/Domain/Store/CrossStoreSyncTests.swift
```

## User Journey

Une mutation invalide `BudgetListStore`. Le retour visible vers l'onglet Budgets ou la racine de sa pile appelle `loadIfNeeded()` : le TTL évite le réseau si le cache est frais, sinon les agrégats serveur remplacent la liste obsolète.

## Tasks to do

| # | Task |
| - | ---- |
| 1 | Distinguer les vrais retours visibles des départs d'onglet, pushes et navigations plus profondes. |
| 2 | Observer l'onglet et la profondeur dans `BudgetListView`, puis appeler `loadIfNeeded()` sans modifier cache ni formule. |
| 3 | Vérifier xcodegen, le nombre réel de tests ciblés et les frontières d'architecture. |

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les tests distinguent un vrai retour visible d'un départ d'onglet ou d'un push dans la pile. |
| 2 | Après invalidation, un retour vers la liste provoque un seul rechargement intelligent ; sans invalidation, le TTL évite le réseau. |
| 3 | Le test ciblé exécute réellement ses cas et la validation d'architecture ne relève aucune formule ou couche touchée hors périmètre. |
