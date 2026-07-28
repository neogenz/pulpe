---
objective: "Tous les findings du review de PUL-312, PUL-313, PUL-314 et PUL-317 sont fermés par des preuves UI déterministes, des mocks contractuels et une validation visuelle web/iOS rattachée au SHA testé."
status: implemented
---

# Plan: Résoudre les écarts de validation des objectifs d’épargne

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Fermer les 10 warnings et le finding mineur du review sans rouvrir le code métier déjà validé. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_26_savings_goal_interval/review.md`, PR #553, PUL-312, PUL-313, PUL-314 et PUL-317 |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Réparer les preuves web et les mocks contractuels | [`phase-1.md`](./phase-1.md) |
| 2 | Ajouter la preuve UI iOS déterministe et réparer la preview | [`phase-2.md`](./phase-2.md) |
| 3 | Inspecter le rendu cross-platform et publier les preuves | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://github.com/neogenz/pulpe/pull/553 | Diff de la feature et PR à maintenir en draft tant que les preuves de ce plan ne sont pas complètes. |

## Decisions

| Decision | Why |
| -------- | --- |
| Garder les tests UI hors ligne : routes Playwright mockées sur le web et scénarios de lancement déterministes sur iOS. | Le dépôt possède déjà ces deux patterns ; ils évitent que l’authentification, le chiffrement ou l’état d’une base locale rendent la preuve intermittente. |
| Limiter les changements de production iOS à un seam d’injection déjà couvert par `SavingsGoalServicing` et à l’environnement de preview manquant. | Les comportements métier sont déjà validés ; le review demande des preuves UI, pas une nouvelle architecture. |
| Suivre explicitement `plan.md` et les trois fichiers de phase malgré l’ignore de `aidd_docs/tasks/`. | `phase-2.md` et `phase-3.md` absents de `HEAD` rendent aujourd’hui le plan et ses critères impossibles à auditer. |
| Garder captures et journaux comme artefacts de PR, nommés avec le SHA et l’environnement testés. | La preuve reste consultable sans versionner des binaires ou des résultats éphémères dans le dépôt. |
