---
objective: "Corriger les régressions d’accessibilité et de visibilité des actions contextuelles iOS, puis les prouver sur petit écran et Dynamic Type."
status: in-progress
---

# Plan: Corriger les actions contextuelles iOS

## Overview

| | |
|---|---|
| Goal | Fermer les quatre warnings de la review sans modifier la hiérarchie visuelle validée : cible tactile complète sur Accueil, ajout de prévision uniquement avec un budget chargé, puis preuve UI reproductible hors authentification. |
| Source | [`review.md`](../2026_07_29_contextualiser_actions_creation_ios/review.md), verdict `changes-requested` du 29 juillet 2026, complété par la demande de plan de correction dans la conversation. |

## Phases

| Phase | Objective | Status |
|---|---|---|
| [1. Corriger les contrats d’interaction](./phase-1.md) | Réparer la hitbox Accueil et restaurer la visibilité conditionnelle du plus Budget avec des tests structurels ciblés. | done |
| [2. Prouver l’accessibilité sur les vues réelles](./phase-2.md) | Tester les actions de production, sans PIN ni backend, sur petit écran et Dynamic Type d’accessibilité. | pending |

## Resources

- [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

## Decisions

- Corriger les deux vues en place : aucun nouveau style, composant partagé ou changement visuel. `CurrentMonthView` conserve son bouton actuel ; `BudgetDetailsView` conserve sa toolbar native et son routage.
- Conditionner uniquement l’ajout de prévision à `screenState.isBudgetPresent`. L’action graphique reste inchangée pour ne pas élargir le correctif à un comportement préexistant.
- Réutiliser `UITestLaunchScenario`, le routage de harness de `PulpeApp` et les mécanismes de préchargement DEBUG existants. Les tests rendent les vraies vues de production ; ils ne répliquent pas les boutons dans une maquette de test.
- Conserver le plan implémenté et sa review dans leur dossier d’origine. Ce dossier séparé porte uniquement le cycle de correction et garde l’historique de statut cohérent.
