---
objective: "Tous les findings ouverts de la review sont corrigés, et la redistribution provisionne sans ambiguïté les budgets mensuels absents avant d'appliquer les montants."
status: implemented
---

# Plan: Corriger la review PUL-12/PUL-8 et provisionner la redistribution

## Overview

| Field      | Value                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------ |
| **Goal**   | Corriger les 8 warnings, 6 minor et l'incohérence documentaire sans élargir la feature.    |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_10_savings_goals_pul_12_pul_8/review.md`                  |

## Phases

| #   | Phase                                           | File                         |
| --- | ----------------------------------------------- | ---------------------------- |
| 1   | Horizon et redistribution canoniques            | [`phase-1.md`](./phase-1.md) |
| 2   | Provisioning et intégrité backend               | [`phase-2.md`](./phase-2.md) |
| 3   | Cohérence, cache et accessibilité web           | [`phase-3.md`](./phase-3.md) |
| 4   | Parité, cache et formulaires iOS                | [`phase-4.md`](./phase-4.md) |
| 5   | Nettoyage du contrat et documentation           | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Provisionner les budgets absents à la confirmation, via `BUDGET_PROVISIONING_PORT`, puis réutiliser la RPC d'update atomique. | Le clic de redistribution reste un sandbox sans écriture. Le précédent PUL-17 existe déjà et sait créer un budget depuis le Mois Type en propageant `savings_goal_id`. |
| Distinguer un mois sans budget provisionnable d'un budget existant sans ligne liée. | Les deux apparaissent aujourd'hui comme `gap`, mais seul le premier peut être créé. Le second doit bloquer la redistribution plutôt que fausser son dénominateur. |
| Limiter création, échéance et timeline à 120 périodes contributives, mois courant inclus. | Le contrat du simulateur est déjà borné à 120 ajustements. Une borne de 50 ans autoriserait jusqu'à 600 créations de budgets sur une confirmation. |
| Accepter temporairement `templateAdjustments: []`, puis retirer la jambe après migration des deux clients. | Le champ appartient à un `strictObject`. Cette transition garde chaque phase déployable tout en supprimant le mécanisme sans appelant à la fin. |
| Accepter que les budgets provisionnés restent créés si la RPC de montants échoue. | `BUDGET_PROVISIONING_PORT` utilise volontairement des transactions courtes séparées. Le retry réutilise ces budgets; une atomicité totale exigerait une nouvelle RPC capable de manipuler des montants chiffrés. |
