---
objective: "Stabiliser la navigation iOS en séparant les destinations globales des actions de création contextuelles."
status: in-progress
---

# Plan: Contextualiser les actions de création iOS

## Overview

| | |
|---|---|
| Goal | Conserver une barre d’onglets stable à quatre destinations et placer chaque création au plus près de l’objet qu’elle produit, sans modifier les flux métier existants. |
| Source | Recommandation UX formulée dans la conversation du 29 juillet 2026 avant la génération des maquettes, vérifiée contre l’implémentation SwiftUI actuelle et les recommandations Apple. |

## Phases

| Phase | Objective | Status |
|---|---|---|
| [1. Séparer l’ajout d’opération de la navigation](./phase-1.md) | Retirer le bouton d’action global de `MainTabView` et rendre l’ajout d’opération visible et contextuel dans Accueil. | done |
| [2. Contextualiser les créations métier](./phase-2.md) | Déplacer l’ajout de prévision dans la toolbar native du détail Budget et verrouiller la cohérence des actions similaires. | done |

## Resources

- [Apple Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple Human Interface Guidelines — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

## Decisions

- `MainTabView` ne possède que les quatre destinations de premier niveau. L’état de présentation de `AddTransactionSheet` est déplacé dans `CurrentMonthView`, propriétaire fonctionnel de l’ajout d’une opération.
- Les créations propres à un écran utilisent les emplacements SwiftUI natifs : action visible dans le contenu d’Accueil, `topBarTrailing` dans le détail Budget. Aucun FAB partagé ou animation de continuité entre deux actions qui créent des objets différents.
- La règle actuelle de visibilité de la barre d’onglets est conservée : visible au premier niveau du détail Budget, masquée uniquement dans les parcours plus profonds ou temporairement avec le clavier. Le chantier ne refond pas ce comportement déjà conforme.
