---
objective: "Le frontend Angular et l’app iOS exposent toujours les fonctionnalités multi-devise sans consulter le flag PostHog retiré, tout en conservant la préférence utilisateur du sélecteur et les primitives génériques de feature flags."
status: in-progress
---

# Plan: Retrait du gate multi-devise

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Retirer le gate `multi-currency-enabled` du web et d’iOS avec un diff de suppression, sans changer les règles métier de devise. |
| **Source** | Demande utilisateur textuelle du 2026-07-27, puis replan après détection des dépendances E2E et Xcode. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Retirer le gate du frontend et du contrat partagé | [`phase-1.md`](./phase-1.md) |
| 2   | Retirer le gate et son store dédié d’iOS | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Supprimer les adaptateurs dédiés à `multi-currency-enabled`, mais conserver les primitives génériques PostHog de lecture/rechargement des flags. | Le flag n’a plus de consommateur après sa sortie de rollout. Garder un service ou un store vide serait du code mort ; les wrappers SDK suffisent pour reconstruire un futur flag lorsqu’un besoin réel apparaît. |
| `showCurrencySelector` devient l’unique condition des sélecteurs optionnels ; les métadonnées FX deviennent l’unique condition des badges et détails de conversion. | Ces deux sources métier existent déjà et expriment directement l’intention utilisateur et l’état des données, sans dépendance analytics. |
