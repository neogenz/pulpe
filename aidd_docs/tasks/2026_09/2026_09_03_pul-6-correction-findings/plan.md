---
objective: "Les findings de PUL-6 sont corrigés, y compris la concurrence entre création simple et génération par lot, puis la branche est réconciliée avec main et validée sur les quatre plateformes."
status: in_progress
---

# Plan: PUL-6 — Corriger les findings de review

## Overview

| Field      | Value                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Lever tous les findings de PUL-6 avec les plus petits correctifs ciblés, intégrer `main` et laisser une PR validée.    |
| **Source** | [`review.md`](../2026_09_01_pul-6-planifier-budgets/review.md) et commentaire de diff PR #721 sur la sérialisation SQL |

## Phases

| #   | Phase                                               | File                         |
| --- | --------------------------------------------------- | ---------------------------- |
| 1   | Garantir la compensation backend                    | [`phase-1.md`](./phase-1.md) |
| 2   | Rendre la validation et la fermeture Web explicites | [`phase-2.md`](./phase-2.md) |
| 3   | Bloquer les sorties mobiles pendant la génération   | [`phase-3.md`](./phase-3.md) |
| 4   | Nettoyer les dérives documentaires                  | [`phase-4.md`](./phase-4.md) |
| 5   | Tolérer la concurrence avec la création simple      | [`phase-5.md`](./phase-5.md) |
| 6   | Réconcilier la branche avec main et valider         | [`phase-6.md`](./phase-6.md) |
| 7   | Lever les findings tardifs de la PR                 | [`phase-7.md`](./phase-7.md) |

## Decisions

| Decision                                                                                                                                                      | Why                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Le rollback du lot précède toute invalidation de cache dans le chemin d'échec, et l'erreur de cache ne remplace jamais l'erreur métier initiale.              | La compensation protège les données; le cache est dérivé et ne doit pas empêcher la suppression du lot partiellement recalculé.                 |
| Une génération déjà soumise est traitée comme non annulable sur Web, iOS et Android.                                                                          | L'API ne fournit aucun protocole d'annulation; bloquer temporairement les sorties évite une écriture silencieuse et la perte du résultat local. |
| Le lot transforme uniquement le conflit de la contrainte `unique_month_year_per_user` en mois ignoré.                                                         | La contrainte reste la source de vérité; les autres violations d'unicité doivent continuer à faire échouer et annuler le lot.                   |
| Le port de génération exprime directement `startMonth`, `startYear` et `count`; le repository dérive les périodes uniquement pour les exclusions d'objectifs. | Le contrat ne doit pas accepter une liste arbitraire que le RPC interpréterait silencieusement comme une plage consécutive.                     |
