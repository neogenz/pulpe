---
objective: "La récupération du plan d’épargne décrit honnêtement sa garantie séquentielle et n’affiche que des actions et libellés exacts sur web et iOS."
status: implemented
---

# Plan: Clore la revue sans sur-traiter la concurrence marginale

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fermer les deux écarts visibles de la revue et qualifier l’idempotence existante, sans ajouter de verrou, RPC ou infrastructure pour deux clients indépendants sur le même compte. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_29_savings_goal_plan_continuity_review_followup/review.md` et décision produit du 29 juillet 2026 |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Cadrer l’idempotence réellement supportée | [`phase-1.md`](./phase-1.md) |
| 2 | Rendre la récupération iOS exacte | [`phase-2.md`](./phase-2.md) |
| 3 | Naturaliser les compteurs web | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Ne pas sérialiser le provisioning entre deux applications ou onglets indépendants du même compte | Les deux clients empêchent déjà les confirmations répétées dans une même interface, le scénario multi-client est déclaré marginal hors du cas produit normal, et une transaction élargie ou une nouvelle garde DB coûterait davantage que le risque accepté. Le contrat sera limité aux reprises séquentielles au lieu de promettre une concurrence non garantie. |
