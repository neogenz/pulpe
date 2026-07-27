---
objective: "Les parcours critiques de PUL-312, PUL-313, PUL-314 et PUL-317 sont prouvés par des tests UI déterministes et par une validation visuelle web/iOS reproductible avant de déclarer la PR #553 prête."
status: in-progress
---

# Plan: Valider les parcours et le rendu des objectifs d’épargne

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Compléter les preuves comportementales et visuelles manquantes de la PR #553 sur Angular et iOS. |
| **Source** | Demande utilisateur, PR #553, PUL-312, PUL-313, PUL-314, PUL-317 et plan revu `2026_07_26_savings_goal_interval` |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Prouver les parcours critiques sur le web | [`phase-1.md`](./phase-1.md) |
| 2 | Prouver les parcours critiques sur iOS | [`phase-2.md`](./phase-2.md) |
| 3 | Valider le rendu cross-platform et publier les preuves | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://github.com/neogenz/pulpe/pull/553 | Diff de la feature et PR à maintenir en draft tant que les preuves de ce plan ne sont pas complètes. |

## Decisions

| Decision | Why |
| -------- | --- |
| Garder les tests UI hors ligne : routes Playwright mockées sur le web et scénarios de lancement déterministes sur iOS. | Le dépôt possède déjà ces deux patterns ; ils évitent que l’authentification, le chiffrement ou l’état d’une base locale rendent la preuve intermittente. |
