---
status: pending
---

# Instruction: Aligner iOS sur le plan canonique et invalider ses projections

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/
├── Pulpe/
│   ├── App/PulpeApp.swift                                           ✏️ wiring invalidation après delete
│   ├── Domain/
│   │   ├── Formulas/SavingsPlanCalculator.swift                    ✏️ gaps provisionnables et base globale
│   │   ├── Models/SavingsGoalPlan.swift                             ✏️ disponibilité et missingMonthAdjustments
│   │   └── Store/SavingsGoalStore.swift                             ✏️ callback de mutation delete
│   ├── Features/SavingsGoals/
│   │   ├── SavingsGoalFormSheet.swift                               ✏️ échéance max
│   │   └── Simulator/
│   │       ├── GoalPlanApplyRecapSheet.swift                        ✏️ retirer le toggle Mois Type mort
│   │       └── GoalPlanSimulatorSheet.swift                         ✏️ parité globalAmount et apply des gaps
│   └── Shared/Components/SavingsGoalPickerField.swift               ✏️ loading, erreur, retry, réconciliation
└── PulpeTests/
    ├── Domain/
    │   ├── Formulas/SavingsPlanCalculatorTests.swift                ✏️ scénario 2/24 et parité
    │   ├── Models/SavingsGoalProgressCodableTests.swift             ✏️ décodage disponibilité
    │   └── Store/SavingsGoalStoreTests.swift                         ✏️ invalidation delete
    └── Features/SavingsGoals/SavingsGoalDetailViewModelTests.swift  ✏️ global + override et payload
```

## Tasks to do

### `1)` Jumeler la redistribution shared

> Le miroir Swift doit produire les mêmes parts et les mêmes blocages.

1. Écrire les cas 2/24, gap non provisionnable, centimes et mois épinglé avant modification.
2. Décoder `isProvisionable` avec une valeur sûre pour les réponses antérieures.
3. Inclure les gaps provisionnables dans simulation et redistribution, pas dans l'édition individuelle.
4. Construire `missingMonthAdjustments` lors de l'application et supprimer le tableau template vide.

### `2)` Corriger la base globale du simulateur

> Un override mensuel ne doit pas effacer la valeur des autres mois.

1. Reproduire `global=250`, override d'un mois à 400.
2. Conserver `globalAmount` dans `setMonth` et pendant la synchronisation d'un draft devenu non uniforme.
3. Laisser le slider actif avec des overrides; un nouveau geste global continue de les remplacer explicitement.
4. Supprimer `hasTemplateChanges`, `updateTemplate` et le toggle toujours faux du récapitulatif.

### `3)` Invalider après suppression

> Les budgets déliés doivent être rechargés partout.

1. Ajouter au store un callback de mutation, sur le pattern app-scoped existant.
2. Après succès seulement, invalider CurrentMonth, BudgetList, Dashboard et BudgetDetailCache.
3. Tester un appel unique en succès et aucun en échec.
4. Corriger le commentaire affirmant que supprimer un objectif n'affecte aucun store frère.

### `4)` Rendre le picker et la date cohérents

> Ne pas délier sur erreur et ne pas autoriser une date rejetée par le serveur.

1. Afficher loading, erreur réessayable et vide réussi à partir des états du `SavingsGoalStore`.
2. Réconcilier la sélection absente seulement après un chargement réussi.
3. Borner le `DatePicker` à la 120e période, en conservant l'échéance existante lors de l'édition.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Swift et TypeScript calculent les mêmes 24 parts et refusent le même gap non provisionnable. |
| 2 | Après un override à 400, les autres mois restent à 250 et le slider reste utilisable. |
| 3 | Une suppression réussie invalide toutes les projections budget; une suppression échouée n'en invalide aucune. |
| 4 | Une erreur de chargement conserve la sélection et une nouvelle date ne peut pas dépasser la 120e période. |
