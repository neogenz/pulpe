---
objective: "Les trois lectures de retrait de SupabaseSavingsGoalRepository sont couvertes au niveau repository, de sorte qu'une dérive de table, de filtre ou de mapping échoue en test unitaire au lieu d'attendre l'intégration."
status: reviewed
---

# Plan: couvrir les lectures de retrait du repository objectifs d'épargne

## Overview

| Field      | Value                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Ajouter la couverture repository absente sur `findLinkedWithdrawals`, `findPlannedWithdrawals` et `findWithdrawals`, d'un seul bloc.        |
| **Source** | Suggestion de revue sur la PR #584 (claude[bot], verdict APPROVE), reprise par Maxime le 2026-08-06.                                        |

Constat vérifié avant d'écrire ce plan : `grep` sur
`supabase-savings-goal.repository.spec.ts` ne trouve **aucune** occurrence des trois
méthodes, alors que chacune alimente un use case réel — `get-savings-goal-progress`
(les deux premières), `savings-goal-withdrawal-policy` et
`get-savings-goal-withdrawals`. Le trou est donc préexistant et complet, pas partiel.

## Phases

| #   | Phase                                    | File                         |
| --- | ---------------------------------------- | ---------------------------- |
| 1   | Couvrir les trois lectures de retrait    | [`phase-1.md`](./phase-1.md) |

Une seule phase : un seul fichier de spec, un seul harnais de mocks, trois méthodes
qui partagent deux lecteurs de lignes privés. Découper serait trois commits qui se
marchent dessus sur le même fichier.

## Decisions

| Decision                                                                                     | Why                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ne PAS asserter la chaîne littérale passée à `.select(...)`                                    | Le client Supabase est mocké : la donnée rendue au test ne dépend pas de la chaîne. Asserter la chaîne compare une constante à une constante — le test échoue à chaque édition sans jamais distinguer une bonne colonne d'une mauvaise. C'est un détecteur de changement, pas un test.                                              |
| Couvrir à la place la **table**, les **filtres** et le **mapping**                              | Ce sont les trois choses qu'un test unitaire peut réellement trancher, et les trois vrais risques de dérive ici : les deux lecteurs visent des tables différentes (`transaction` vs `budget_line`) pour un domaine jumeau, le retrait annoncé porte une garde `kind = income`, et chaque ligne est remise à plat depuis `monthly_budget`. |
| Ne pas toucher au code de production                                                           | La demande est une lacune de couverture, pas un défaut. Toute correction de production sortirait du périmètre et rendrait la revue de la PR #584 périmée.                                                                                                                                                                          |
