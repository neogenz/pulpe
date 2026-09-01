---
objective: "Un utilisateur peut planifier jusqu'à 36 budgets consécutifs depuis un Mois Type sur le Web, iOS et Android, avec une création atomique et un résultat distinguant les mois créés des mois déjà existants."
status: implemented
---

# Plan: PUL-6 — Planifier une période de budgets

## Overview

| Field      | Value                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Exposer le générateur de budgets existant dans les trois listes clientes et garantir que chaque série est créée sans résultat partiel.                    |
| **Source** | [PUL-6 — Planifier une période de budgets depuis un Mois Type](https://linear.app/pulpe/issue/PUL-6/planifier-une-periode-de-budgets-depuis-un-mois-type) |

## Phases

| #   | Phase                                       | File                         |
| --- | ------------------------------------------- | ---------------------------- |
| 1   | Verrouiller le contrat de période partagé   | [`phase-1.md`](./phase-1.md) |
| 2   | Rendre la génération backend atomique       | [`phase-2.md`](./phase-2.md) |
| 3   | Ajouter la planification à la liste Web     | [`phase-3.md`](./phase-3.md) |
| 4   | Ajouter la planification à la liste iOS     | [`phase-4.md`](./phase-4.md) |
| 5   | Ajouter la planification à la liste Android | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision                                                                                                                                                      | Why                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conserver `POST /v1/budgets/generate` et son DTO `templateId/startMonth/startYear/count`.                                                                     | Le contrat sert déjà l'onboarding Web et Android; une seconde route ou un DTO début/fin dupliquerait le même intent.                                               |
| Ajouter un RPC SQL `SECURITY INVOKER` qui calcule et crée toute la série dans une transaction, en déléguant chaque mois au RPC feuille existant.              | Une erreur PostgreSQL annule toute la série, tandis que le RPC existant reste l'unique implémentation de la copie des lignes, tags et liens d'objectifs d'épargne. |
| Calculer les exclusions d'objectifs une seule fois côté repository et les transmettre par période au RPC de série.                                            | Cela préserve les règles payDay-aware de `docs/SAVINGS.md` §3.5 sans recopier leur logique dans PostgreSQL ni refaire jusqu'à 36 lectures identiques.              |
| Réutiliser `periodIndex`/`periodFromIndex` côté TypeScript et ajouter leur miroir exact à `BudgetPeriodCalculator` côté Swift.                                | Les trois clients obtiennent le même calcul inclusif et le même passage d'année sans introduire un nouveau calculateur ni une dépendance.                          |
| Recalculer les budgets créés dans l'ordre chronologique après le commit SQL, puis supprimer tout le lot avec l'écriture ensembliste existante en cas d'échec. | Les soldes restent chiffrés par `ENCRYPTION_PORT`; la création SQL est atomique et le rollback applicatif ne supprime jamais les budgets préexistants ignorés.     |
