---
objective: "La branche PUL-186 est rebasée sur la preview courante, son comportement fail-open est revalidé, et la PR obtient une review sans warning."
status: in-progress
---

# Plan: Resynchroniser et conclure PUL-186

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Rejouer PUL-186 sur la cible actuelle, prouver qu'aucune régression n'est introduite, puis remettre la PR en état de merge vérifié. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_15_pul_186_review_fixes/review.md` et PR `neogenz/pulpe#498` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Rebaser sur la preview courante | [`phase-1.md`](./phase-1.md) |
| 2 | Revalider et conclure la PR | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/neogenz/pulpe/pull/498 | HEAD `e7fb29c4`, cible PR figée à `dd33fdc0`, `origin/preview` à `e9794ab7`, required check `CI Success` vert et zéro thread ouvert. |

## Decisions

| Decision | Why |
| --- | --- |
| Rebaser plutôt que fusionner `preview` dans la branche | La PR doit prouver son intégration sur la cible actuelle avec un historique feature lisible et un nouveau HEAD testé. |
| Ne pas réorganiser le module backend dans ce correctif | L'écart est mineur, le plan précédent l'a explicitement borné, `lint:arch` passe, et ce refactor n'améliorerait pas la sûreté fonctionnelle de PUL-186. |
| N'utiliser que `--force-with-lease` après accord explicite | Le rebase réécrit l'historique distant ; le lease évite d'écraser une mise à jour concurrente. |
