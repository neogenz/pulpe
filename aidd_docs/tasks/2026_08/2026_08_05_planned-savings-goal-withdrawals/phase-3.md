---
status: done
track: B
---

# Instruction: Projection et simulateurs cohérents entre TypeScript et Swift

Une prévision source ne modifie pas le confirmé, mais elle doit diminuer la projection. Quand un
retrait réel est alloué à cette prévision, seule la partie non encore réalisée reste prévisionnelle.
Le calcul doit être écrit une fois en TypeScript puis miroiré en Swift dans le même commit.

## Architecture ciblée

```text
docs/SAVINGS.md                                        ✏️ cycle prévu → réel et formules
shared/src/calculators/
├── savings-goal-progress.ts                           ✏️ retrait planifié restant
├── savings-goal-progress.spec.ts                      ✏️ projection sans double compte
├── savings-goal-plan.ts                               ✏️ timeline/simulation
└── savings-goal-plan.spec.ts                          ✏️ parité de scénarios
backend-nest/src/modules/savings-goal/
├── domain/ports/savings-goal-repository.port.ts       ✏️ lignes source + allocation
├── application/get-savings-goal-progress.use-case.ts  ✏️ input canonique
└── infrastructure/persistence/supabase-savings-goal.repository.ts
ios/Pulpe/Domain/
├── Models/SavingsGoalProgress.swift                   ✏️ champs additifs, défaut 0
└── Formulas/SavingsPlanCalculator.swift               ✏️ miroir exact
ios/PulpeTests/Domain/Formulas/
├── SavingsPlanCalculatorTests.swift
└── SavingsPlanCalculatorWithdrawalTests.swift
```

## Tasks to do

### `1)` Fournir au calculateur les liens nécessaires

1. Documenter dans `docs/SAVINGS.md` le cycle prévu → réel, les deux stocks confirmé/projeté et les
   exemples numériques 500/300/700 ci-dessous.
2. Ajouter un type `LinkedPlannedWithdrawal` : id de prévision, montant positif, mois et année.
3. Étendre `LinkedSavingWithdrawal` avec `budgetLineId: string | null` pour distinguer retrait libre et
   retrait réalisant une prévision.
4. Le repository savings-goal charge :
   - toutes les prévisions `income` dont `source_savings_goal_id` vise l'objectif ;
   - tous les retraits réels existants, avec leur `budget_line_id`.
5. Garder les montants positifs. Le signe reste une règle du calcul et de la présentation.

### `2)` Définir le reliquat sans double décompte

Pour chaque prévision source :

```text
réel alloué       = Σ retraits dont budgetLineId = prévision.id
retrait restant   = max(0, prévision.amount - réel alloué)
```

1. `confirmed` continue de retrancher tous les retraits réels, libres ou alloués.
2. `projected` retranche en plus les retraits restants des périodes courante et futures, jusqu'à
   l'échéance de l'objectif. Une prévision manquée dans un mois passé ne se réalise pas fictivement
   plus tard, comme pour une contribution passée non pointée.
3. Un réel supérieur au prévu n'engendre jamais de reliquat négatif ; l'excédent reste déjà dans
   `confirmed`.
4. `plannedCumulative`, `confirmedAmount` et `confirmedPace` restent des mesures de contribution : ne
   pas y injecter une « contribution négative ».

### `3)` Rendre l'impact lisible dans la timeline

1. Ajouter à `SavingsPlanTimelineMonth` : `plannedWithdrawalAmount`,
   `remainingPlannedWithdrawalAmount` et `projectedCumulative`, optionnels/additifs avec des défauts
   compatibles côté iOS. Le reliquat vaut zéro pour une période passée/verrouillée ; le cumul
   projeté est calculé par le serveur et sert aussi à l'aperçu du picker à une période donnée.
2. Garder `withdrawnAmount` pour les retraits réels. Le cumul simulé soustrait
   `withdrawnAmount + remainingPlannedWithdrawalAmount` après la contribution du mois.
3. La redistribution ajoute cette même sortie effective à l'effort restant ; elle doit retomber sur
   la cible au centime près.
4. Seuls les retraits **réels** antérieurs hors des 120 périodes sont reportés dans la première ligne.
   Une prévision passée non réalisée est échue et n'entre plus dans la projection.
5. Le simulateur n'édite que les contributions. Afficher le retrait prévu dans une sous-ligne non
   éditable empêche l'utilisateur de croire qu'un montant négatif doit être saisi.

### `4)` Miroirer strictement en Swift

1. Décoder les deux nouveaux montants avec `decodeIfPresent ?? 0` pour tolérer un déploiement API
   progressif.
2. Reproduire dans `SavingsPlanCalculator.simulate` et `redistributeRemainingEffort` exactement la
   somme effective TypeScript.
3. Rejouer les mêmes vecteurs : plan seul, partiellement réalisé, totalement réalisé, réel supérieur,
   retrait libre + alloué, sortie après échéance et fenêtre saturée.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le serveur fournit chaque prévision source et chaque retrait avec son éventuel `budgetLineId`, sans fuite inter-tenant. |
| 2 | Prévu 500/réel 0 retranche 500 au projeté ; réel 300 retranche 300 au confirmé + 200 au projeté ; réel 600 ne retranche aucun reliquat. |
| 3 | La timeline et la redistribution aboutissent au même total effectif, y compris au bord des 120 périodes. |
| 4 | Les tests TS et Swift utilisent les mêmes cas et rendent les mêmes montants au centime près. |
