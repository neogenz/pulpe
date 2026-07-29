---
objective: "La récupération des prévisions manquantes et le rattachement d’une épargne lissée restent exacts, accessibles et localisés sur web et iOS dans tous les états validés par la revue."
status: in-progress
---

# Plan: Fermer les écarts de continuité du plan d’épargne

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les six constats de la revue sans nouveau flux, endpoint ou composant. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_29_savings_goal_plan_continuity/review.md` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Durcir le contrat des prévisions manquantes | [`phase-1.md`](./phase-1.md) |
| 2 | Rendre chaque état de récupération exact et accessible | [`phase-2.md`](./phase-2.md) |
| 3 | Sécuriser et localiser le lissage lié | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Rendre uniquement `missingMonthAdjustments.amount` strictement positif. | Une nouvelle Prévision à 0 n’a aucun effet métier, tandis qu’un `monthAdjustment` à 0 reste nécessaire pour ramener une Prévision existante à zéro. |
| Exposer une erreur publique dédiée au dépassement de l’échéance d’un objectif. | Le trigger possède déjà cette garde atomique ; un code 422 localisé évite de dupliquer le calcul payDay-aware dans les deux clients. |
