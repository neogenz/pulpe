---
objective: "Fermer les 15 findings actionnables du review de l’intervalle d’épargne sans élargir la feature, puis rattacher au SHA validé des preuves web et iOS complètes."
status: in-progress
---

# Plan: Corriger les findings à valeur réelle de l’intervalle d’épargne

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les incohérences métier, les courses d’écriture et les régressions cross-platform, puis remettre la PR en état d’être mergée sur preuves. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_26_savings_goal_interval/review.md` — verdict `changes-requested`, 14 warnings et 1 finding mineur. |
| **Included** | Les 15 findings actionnables : 9 fonctionnels, 5 code/conform/rot et 1 test fragile. |
| **Excluded** | P2.1, étape TDD historique non reproductible, et P5.8, ordre de rollout production extérieur à la branche ; tous deux sont déjà `not-applicable` dans le review. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Sécuriser les invariants shared et backend | [`phase-1.md`](./phase-1.md) |
| 2 | Corriger l’orchestration Angular | [`phase-2.md`](./phase-2.md) |
| 3 | Consolider et prouver les surfaces iOS | [`phase-3.md`](./phase-3.md) |
| 4 | Produire la preuve de merge cross-platform | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://www.postgresql.org/docs/current/explicit-locking.html | `FOR UPDATE` et `FOR KEY SHARE` sérialisent les opérations concurrentes sur la ligne objectif et retournent la version actualisée après attente. |
| https://www.postgresql.org/docs/current/plpgsql-trigger.html | Un trigger `BEFORE` participe à la transaction appelante, peut refuser une écriture et doit retourner `NEW` pour la laisser continuer. |
| https://developer.apple.com/documentation/xctest/adding-attachments-to-tests-activities-and-issues | Les captures XCUITest peuvent rester dans le résultat réussi avec `XCTAttachment.Lifetime.keepAlways`. |
| https://developer.apple.com/documentation/xcode/diagnosing-issues-in-the-appearance-of-your-running-app | L’apparence sombre et les tailles Dynamic Type sont des variantes d’environnement à valider explicitement. |
| https://github.com/neogenz/pulpe/pull/553 | PR à maintenir en draft tant qu’un critère ou finding reste ouvert ; les preuves doivent référencer le SHA exact. |

## Decisions

| Decision | Why |
| --- | --- |
| Étendre par une nouvelle migration le trigger `enforce_savings_goal_line_link` pour verrouiller la ligne objectif et refuser un nouveau lien `budget_line` hors horizon. | Le trigger est déjà le point de passage commun à tous les écrivains. Une règle centrale ferme la course sans ajouter un verrou différent dans chaque RPC ou repository. |
| Garder la limite de 120 périodes sur l’échéance, mais retirer la limite de 120 IDs de réconciliation. | Une période peut contenir plusieurs prévisions ; une borne temporelle ne doit pas devenir une borne arbitraire sur la cardinalité du snapshot exact. |
| Après un PATCH atomique d’échéance, traiter une transition de statut comme une seconde décision advisory uniquement si le PATCH a réellement réussi. | Les deux décisions portent sur deux ensembles différents : lignes hors nouvelle échéance, puis lignes futures restantes d’un objectif arrêté. |
| Faire de `GoalProgressCard` l’unique rendu iOS et charger le Mois Type indépendamment de la liste auxiliaire d’objectifs. | Les deux implémentations divergent déjà et le chargement auxiliaire ne doit pas retarder la donnée principale. |
| Conserver captures et `.xcresult` comme artefacts de PR, pas comme binaires versionnés. | La preuve doit être rattachée au SHA et à l’environnement sans alourdir durablement le dépôt. |
