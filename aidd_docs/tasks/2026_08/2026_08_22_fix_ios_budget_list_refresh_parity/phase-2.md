---
status: done
---

# Instruction: Réparer les retours tardifs et le quick-add après review

## Architecture projection

```txt
ios/
├── Pulpe/
│   ├── Domain/Store/BudgetListStore.swift
│   └── Features/{Budgets/BudgetList,CurrentMonth/Components}/
└── PulpeTests/
    ├── Domain/Store/CrossStoreSyncTests.swift
    └── Integration/StoreRaceConditionTests.swift
```

## Tasks to do

| # | Task |
| - | ---- |
| 1 | Exposer une génération incrémentée uniquement par `invalidateCache()` et la consommer lorsque Budgets est actif à la racine. |
| 2 | Conditionner le dépilage à l'onglet actif et coalescer deux `loadIfNeeded()` simultanés. |
| 3 | Router la transaction confirmée par `CurrentMonthStore.addTransaction` et prouver l'invalidation app existante. |

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Une invalidation arrivée après le retour visible déclenche exactement un refetch et actualise les agrégats. |
| 2 | Un dépilage 1→0 ne charge que sur l'onglet Budgets et deux demandes intelligentes simultanées partagent un seul fetch. |
| 3 | Le quick-add ajoute la transaction au store courant et son seam invalide les caches liste/dashboard. |
