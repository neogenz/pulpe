# Validation iOS — Objectif et Lissage

## Environnement

| Champ | Valeur |
| --- | --- |
| Date | 30 juillet 2026 |
| Branche | `codex/fix-ios-goal-spread-metadata` |
| Phase | Stabilisation du journey Objectif/Lissage |
| Simulateur | iPhone SE (3e génération), iOS 18.5 (22F77) |
| UDID | `4BFB26E9-0BA2-442A-AAAE-0AF677407DD8` |
| Preview | `PulpePreview`, iOS 26.5, `44C2CE50-B590-44A6-B315-23F8D5ACCABE` |
| Scénario | `UITEST_BUDGET_GOAL_SPREAD_METADATA` |
| Donnée | Épargne « Voyage au Japon », 413 CHF, objectif `ui-test-goal`, lissage `33333333-7777-4777-8777-333333333333` |

Le harness est autonome : un service local strict alimente budget, tags et occurrences ; le service d’objectif existant alimente sa progression. Le scénario entre par la vraie carte d’août de `BudgetsTab`, puis utilise les routes et vues de production. Les initialiseurs de production conservent leurs services partagés par défaut.

## Matrice observée

| Écran | Taille | Apparence | Résultat |
| --- | --- | --- | --- |
| Ligne budget | Large | Claire | Une métadonnée `Lissé · objectif Voyage au Japon`, montant et chevron séparés. |
| Ligne budget | Large | Sombre | Même hiérarchie, contraste conservé. |
| Détail | Large | Claire | Deux lignes distinctes : `Objectif : Voyage au Japon` puis `Épargne lissée`. |
| Détail | Large | Sombre | Même hiérarchie, contraste conservé. |
| Ligne budget | Accessibility 3 | Claire | Nom et métadonnée passent sur plusieurs lignes ; la carte reste ouvrable. |
| Ligne budget | Accessibility 3 | Sombre | Même reflow, contraste conservé. |
| Détail | Accessibility 3 | Claire | Un geste contrôlé cadre simultanément les deux actions, hittables et sans intersection. |
| Détail | Accessibility 3 | Sombre | Même cadrage, même séparation et mêmes cibles tactiles. |

Le bundle `/tmp/pulpe-goal-spread-final.xcresult` conserve dix captures XCTest : une ligne et un détail pour chacun des quatre modes, puis les deux destinations du journey.

## Interactions

| Action | Preuve |
| --- | --- |
| Ouvrir la prévision depuis la carte combinée | `budgetLineDetailPageRoot` existe après le tap. |
| Activer l’objectif | `savingsGoalDetailRoot` affiche `Montant de départ` et la progression semée, sans `Connexion impossible`. |
| Activer le lissage | La feuille `Épargne lissée` affiche `Juillet 2026`, 137 CHF, sans `Connexion impossible`. |
| Cibles Objectif et Lissage | Existence, `isHittable`, hauteur ≥ 44 pt et cadres sans intersection dans les quatre modes. |

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| Deux UI tests Objectif/Lissage | Passés : matrice 4 modes et destinations réelles. |
| `BudgetLinePresentationTests` | Passé. |
| `xcodebuild build -scheme PulpePreview` | Passé, installé et lancé sur le simulateur Preview iOS 26.5. |
| SwiftLint strict sur les 9 fichiers Swift modifiés | 0 violation. |
| `pnpm quality` | 11/11 tâches passées. |
| `git diff --check` | Passé. |

Xcode conserve les avertissements préexistants d’isolation d’acteur dans le setup UI, d’inférence dans `PulpeChip.swift:95`, de configuration PostHog dépréciée et de version LLDB du simulateur ; aucun nouveau warning n’est attribuable au correctif.
