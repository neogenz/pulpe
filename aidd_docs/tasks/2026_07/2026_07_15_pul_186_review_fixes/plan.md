---
objective: "La PR PUL-186 garantit les versions iOS avec ou sans notes, respecte les conventions backend et iOS, puis obtient une review sans warning."
status: implemented
---

# Plan: Corriger les findings de review PUL-186

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fermer les deux trous de release, traiter les deux écarts mineurs et conclure les discussions de la PR #498. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_11_pul_186_whats_new_ios/review.md` et PR `neogenz/pulpe#498` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Fermer les invariants de données et de release | [`phase-1.md`](./phase-1.md) |
| 2 | Aligner le flux backend et l'annulation iOS | [`phase-2.md`](./phase-2.md) |
| 3 | Prouver le correctif et conclure la PR | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/neogenz/pulpe/pull/498 | HEAD `9d177039`, merge GitHub `CLEAN`, checks verts et discussions non résolues à traiter. |

## Decisions

| Decision | Why |
| --- | --- |
| Une entrée backend est toujours une projection iOS complète avec `iosVersion` | Une version sans note est représentée par l'absence d'entrée ; conserver une propriété optionnelle recrée un échec silencieux. |
| Ajouter un use-case léger sans déplacer tout le module | Le contrôleur respecte la convention déclarée avec un diff ciblé ; une réorganisation complète des dossiers serait hors scope. |
