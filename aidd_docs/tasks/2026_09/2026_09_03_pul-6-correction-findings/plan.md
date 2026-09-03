---
objective: "Les six findings de la review PUL-6 sont corrigés : compensation backend garantie, validation Web explicite, sorties pendant la génération bloquées sur les trois clients, duplication et dérives documentaires supprimées."
status: in-progress
---

# Plan: PUL-6 — Corriger les findings de review

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Lever le verdict bloquant de PUL-6 avec les plus petits correctifs ciblés et leurs régressions automatisées. |
| **Source** | [`review.md`](../2026_09_01_pul-6-planifier-budgets/review.md) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Garantir la compensation backend | [`phase-1.md`](./phase-1.md) |
| 2 | Rendre la validation et la fermeture Web explicites | [`phase-2.md`](./phase-2.md) |
| 3 | Bloquer les sorties mobiles pendant la génération | [`phase-3.md`](./phase-3.md) |
| 4 | Nettoyer les dérives documentaires | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Le rollback du lot précède toute invalidation de cache dans le chemin d'échec, et l'erreur de cache ne remplace jamais l'erreur métier initiale. | La compensation protège les données; le cache est dérivé et ne doit pas empêcher la suppression du lot partiellement recalculé. |
| Une génération déjà soumise est traitée comme non annulable sur Web, iOS et Android. | L'API ne fournit aucun protocole d'annulation; bloquer temporairement les sorties évite une écriture silencieuse et la perte du résultat local. |
