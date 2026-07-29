# Validation iOS — Objectif et Lissage

## Environnement

| Champ | Valeur |
| --- | --- |
| Date | 29 juillet 2026 |
| Branche | `codex/fix-ios-goal-spread-metadata` |
| Commit de phase | `<phase-commit>` |
| Simulateur | iPhone SE (3e génération), iOS 18.5 (22F77) |
| UDID | `4BFB26E9-0BA2-442A-AAAE-0AF677407DD8` |
| Scénario | `UITEST_BUDGET_GOAL_SPREAD_METADATA` |
| Donnée | Épargne « Voyage au Japon », 413 CHF, objectif `ui-test-goal`, lissage `33333333-7777-4777-8777-333333333333` |

Le harness est autonome : il alimente les caches et stores existants, entre par la vraie carte d’août de `BudgetsTab`, puis utilise les routes de production. Aucun backend ni aucune vue de production n’est modifié par cette phase.

## Matrice observée

| Écran | Taille | Apparence | Résultat |
| --- | --- | --- | --- |
| Ligne budget | Large | Claire | Une métadonnée `Lissé · objectif Voyage au Japon`, montant et chevron séparés. |
| Ligne budget | Large | Sombre | Même hiérarchie, contraste conservé. |
| Détail | Large | Claire | Deux lignes distinctes : `Objectif : Voyage au Japon` puis `Épargne lissée`. |
| Détail | Large | Sombre | Même hiérarchie, contraste conservé. |
| Ligne budget | Accessibility 3 | Claire | Nom et métadonnée passent sur plusieurs lignes ; la carte reste ouvrable. |
| Ligne budget | Accessibility 3 | Sombre | Même reflow, contraste conservé. |
| Détail | Accessibility 3 | Claire | Objectif et lissage restent deux cibles scrollables, sans intersection. |
| Détail | Accessibility 3 | Sombre | Même séparation et mêmes cibles tactiles. |

Le test conserve dix captures XCTest : une ligne et un détail en Large pour chaque apparence, puis une ligne et deux positions du détail en Accessibility 3 pour chaque apparence. Elles sont attachées à `testGoalAndSpreadMetadataRemainUsableAcrossAccessibilityMatrix` dans `/tmp/pulpe-goal-spread-class.xcresult`.

## Interactions

| Action | Preuve |
| --- | --- |
| Ouvrir la prévision depuis la carte combinée | `budgetLineDetailPageRoot` existe après le tap. |
| Activer l’objectif | La barre de navigation affiche `Voyage au Japon`. |
| Activer le lissage | La feuille affiche `Dépense lissée`. |
| Cibles Objectif et Lissage | Hauteur mesurée ≥ 44 pt et cadres sans intersection dans les quatre modes. |

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| `BudgetLineLongPressTests` | 4/4 passés, dont la matrice et les deux destinations. |
| `BudgetLinePresentationTests` + `BudgetDetailsArchitectureTests` | 15 tests / 16 exécutions paramétrées passés. |
| `xcodebuild build -scheme PulpeLocal` | Passé sur le simulateur isolé. |
| SwiftLint strict sur les 4 fichiers modifiés | 0 violation. |
| `pnpm quality` | 11/11 tâches passées. |
| `git diff --check` | Passé. |

Le lint strict global reste rouge sur 19 violations préexistantes hors diff. Xcode conserve aussi les avertissements préexistants d’isolation d’acteur dans le setup UI, d’inférence dans `PulpeChip.swift:95` et de version LLDB du simulateur ; aucun nouveau warning n’est attribuable au correctif.
