---
objective: "Le correctif de la PR #554 converge après un replay 404 et passe localement le runner Vitest réel sans élargir le périmètre."
status: in-progress
---

# Plan: Finaliser la suppression d’un objectif

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fermer les deux défauts web confirmés et produire un état local validé, prêt à publier séparément. |
| **Source** | Demande utilisateur, PR #554 et `aidd_docs/tasks/2026_07/2026_07_27_suppression-objectif-impact-review-fixes/review.md` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Web — converger quand l’objectif est déjà absent | [`phase-1.md`](./phase-1.md) |
| 2 | Web — exécuter le dialogue avec le runner Vitest réel | [`phase-2.md`](./phase-2.md) |
| 3 | Validation complète du correctif | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/neogenz/pulpe/pull/554 | État des checks, finding 404 ouvert et description de validation obsolète. |
| https://angular.dev/guide/testing/components-scenarios | Les tests de composants Angular 22 sous Vitest reposent sur `TestBed` et les stratégies asynchrones natives. |
| https://angular.dev/api/core/Component | `templateUrl` et `styleUrl` sont les métadonnées Angular prévues pour les ressources externes du composant. |

## Decisions

| Decision | Why |
| --- | --- |
| Traiter `SAVINGS_GOAL_NOT_FOUND` comme une suppression terminale dans le store web après une commande explicite. | L’objectif absent satisfait déjà l’intention ; solder l’état local évite un retry destructif et aligne le web sur iOS. |
| Garder le runner Vitest direct et adapter uniquement la spec du dialogue avec ses ressources réelles. | Le défaut est local à la première spec DOM d’un composant externalisé ; migrer tout le runner ou le setup global élargirait inutilement le risque. |
