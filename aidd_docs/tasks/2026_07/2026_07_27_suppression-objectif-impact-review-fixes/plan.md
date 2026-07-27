---
objective: "Les quatre findings de la revue PUL-319 sont fermés sans modifier les trois périmètres de suppression ni leur aperçu exhaustif."
status: in-progress
---

# Plan: Corriger la revue de la suppression d’un objectif

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fiabiliser les suites post-commit backend et iOS, rafraîchir le Mois Type sur iOS et remettre le dialogue web en conformité structurelle. |
| **Source** | Demande utilisateur et `aidd_docs/tasks/2026_07/2026_07_27_suppression-objectif-impact/review.md` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Backend — classifier toute défaillance post-commit | [`phase-1.md`](./phase-1.md) |
| 2 | iOS — réconcilier la suppression et rafraîchir le Mois Type | [`phase-2.md`](./phase-2.md) |
| 3 | Web — extraire la vue du dialogue sans changer son rendu | [`phase-3.md`](./phase-3.md) |
| 4 | Validation croisée et nouvelle revue | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Mapper l’échec d’invalidation du cache et l’échec de recalcul vers le code partiel existant après le commit DB. | Les deux surviennent après une suppression irréversible et doivent obliger les clients à solder l’objectif sans proposer de retry destructif. |
| Considérer `ERR_SAVINGS_GOAL_NOT_FOUND` comme l’état terminal attendu lorsqu’il revient du POST iOS déjà consenti. | Le retry transport peut rejouer une requête dont le premier passage a commis ; l’absence de l’objectif prouve alors que l’intention de suppression est satisfaite sans ajouter de table d’idempotence. |
| Porter une version d’invalidation du Mois Type dans `SavingsGoalStore` et la consommer depuis `TemplateDetailsView`. | Le store global existe déjà dans l’environnement iOS ; un compteur observable ferme le cache local persistant sans créer un nouveau store ou un bus d’événements. |
| Externaliser uniquement le template et les styles du dialogue Angular. | Le composant garde sa logique et ses tests actuels, passe sous 300 lignes et n’introduit aucune abstraction de présentation supplémentaire. |
