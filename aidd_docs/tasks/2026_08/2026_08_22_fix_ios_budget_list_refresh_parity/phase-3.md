---
status: done
---

# Instruction: Sécuriser reset et l'ajout hors budget

## Architecture projection

```txt
ios/Pulpe/Domain/Store/{BudgetListStore,CurrentMonthStore}.swift
ios/PulpeTests/{Integration/StoreRaceConditionTests,Domain/Store/CrossStoreSyncTests}.swift
```

## Tasks to do

| # | Task |
| - | ---- |
| 1 | Rendre la génération de chargement monotone au `reset()` et prouver qu'une ancienne tâche ne perd pas la référence de la nouvelle. |
| 2 | N'ajouter que les transactions du budget courant ; sinon invalider le store tout en conservant `onMutation`. |

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Après reset, une demande concurrente rejoint le nouveau fetch au lieu d'en créer un troisième. |
| 2 | Budget absent ou différent : aucune transaction locale ; budget correspondant : ajout unique ; chaque cas notifie les stores frères. |
