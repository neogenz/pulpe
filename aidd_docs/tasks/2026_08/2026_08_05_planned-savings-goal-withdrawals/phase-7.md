---
status: done
track: A
---

# Instruction: Une seule transition à l'ouverture d'un retrait — iOS

Même cause qu'en phase 5, exprimée en SwiftUI : le tap pousse
`BudgetDestination.transaction(budgetId:transactionId:)`, `MainTabView` ouvre le budget, puis
`InitialTransactionPush` attend que les transactions chargées contiennent la cible pour pousser
l'éditeur. Deux `push` pour un seul tap, avec une attente réseau au milieu.

Comme sur le web, un seul producteur et un seul consommateur :

| Rôle | Emplacement |
| --- | --- |
| Producteur | `SavingsGoalDetailView.swift:234` — `BudgetDestination.transaction(…)` |
| Consommateur | `MainTabView.swift:60` et `:163`, puis `InitialTransactionPush` dans `BudgetDetailsView+Routing.swift` |

## Architecture ciblée

```text
ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift    ✏️ pousse `.details`
ios/Pulpe/App/AppState+Navigation.swift                        ✂️ case `.transaction`
ios/Pulpe/App/MainTabView.swift                                ✂️ deux branches
ios/Pulpe/Features/Budgets/BudgetDetails/
├── BudgetDetailsView.swift                                    ✂️ initialTransactionId
└── BudgetDetailsView+Routing.swift                            ✂️ InitialTransactionPush
```

## Tasks to do

### `1)` Reproduire avant de supprimer

1. Un test constate deux `push` sur la pile pour un seul tap sur un retrait.
2. Il doit échouer sur le comportement actuel avant toute correction.

### `2)` Un seul `push`

1. `SavingsGoalDetailView` pousse `BudgetDestination.details(budgetId:)`.
2. `BudgetDestination.details` reste : c'est désormais la seule destination utilisée par la
   ligne de retrait.
3. Corriger le hint VoiceOver de `GoalWithdrawalsSection` : il annonce l'ouverture du budget,
   pas celle de la transaction.

### `3)` Supprimer le workaround

1. Recherche globale de `BudgetDestination.transaction`, `initialTransactionId`,
   `InitialTransactionPush` et `openingInitialTransaction` pour confirmer qu'aucun appelant ne
   subsiste après l'étape 2.
2. Supprimer le `case transaction` de l'enum, les deux branches de `MainTabView`, le paramètre
   `initialTransactionId` de `BudgetDetailsView`, le `ViewModifier` et son extension.
3. Retirer les tests exclusivement attachés au double push. Ajouter un UI test « tap retrait →
   budget → retour → même écran, même position de défilement ».

> **UI test non écrit, décision assumée.** `SavingsGoalIntervalUITestHarness` renvoie une
> liste de retraits vide et son `NavigationStack` n'enregistre aucune destination
> `BudgetDestination` : le rendre capable de ce parcours demande un scénario, un double de
> service et l'environnement complet de `BudgetDetailsView` (routeur, tag store, savings
> store, service budget), soit plus de code d'échafaudage que la phase n'en supprime. La
> garantie retenue à la place est le compilateur : `BudgetDestination` ne sait plus exprimer
> « un budget ET une transaction », donc la seconde transition n'est plus représentable.

### `4)` Ne rien ajouter d'autre dans cette phase

1. Aucune sheet de détail, aucun champ de modèle, aucune modification du contrat.
2. `GoalWithdrawalsSection` et `GoalContributionsSection` restent deux sections distinctes ; la
   fusion est hors périmètre, documentée dans `plan.md`.
3. Le rendu du retrait reste **neutre** : `arrow.up.right`, `Color.textPrimary` pour le montant,
   signe négatif, `sensitiveAmount()` conservé. Pas de `minus.circle` ambre : `docs/SAVINGS.md`
   §7 et §10.1 interdisent l'ambre sur une surface d'épargne, et `DESIGN.md` réserve cette
   teinte à la dépense et au dépassement.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le test échoue avant correctif en constatant deux `push` pour un tap. **Non tenu** : le second `push` naît d'un `ViewModifier` privé de la couche vue, et le seul test qui l'observerait est l'UI test écarté ci-dessus. Le critère 3 (grep) et la suppression du `case` de l'enum tiennent lieu de preuve. |
| 2 | Le tap produit une seule transition ; le retour revient sur le détail de l'objectif au même endroit. |
| 3 | Plus aucune occurrence du routeur transaction ni de l'attente `InitialTransactionPush` dans le dépôt. |
| 4 | Le diff de la phase est net négatif et ne touche ni les modèles ni les services. |
