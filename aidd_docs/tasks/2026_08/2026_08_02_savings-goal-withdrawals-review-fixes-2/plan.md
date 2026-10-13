---
objective: "Un revenu ne peut plus pointer vers l'objectif d'épargne d'un autre utilisateur, un retrait creuse le cumul quel que soit le mois où il tombe, et la documentation dit ce que le code calcule."
status: implemented
---

# Plan: correctifs de revue PUL-329 (round 2)

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Fermer les cinq constats de la deuxième revue du diff PUL-329 sans anticiper les phases 3 à 6 du plan parent |
| **Source** | [`../2026_08_02_savings-goal-withdrawals/review.md`](../2026_08_02_savings-goal-withdrawals/review.md) — verdict `changes-requested`, 0 critical, 1 warning, 4 minor |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Refuser un objectif d'épargne qui n'appartient pas au porteur du revenu | [`phase-1.md`](./phase-1.md) |
| 2   | Faire compter le retrait dans tous les mois du plan | [`phase-2.md`](./phase-2.md) |
| 3   | Réaligner la documentation sur les formules réellement calculées | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| Base locale migrée (`postgresql://…:54322`), scénario attaquant/victime en `BEGIN … ROLLBACK` | La faille est réelle et porte deux effets : sous le rôle `authenticated`, un utilisateur lie son revenu libre à l'objectif d'un tiers ; le renommage par la victime recopie son nom dans la ligne de l'attaquant, et une écriture de l'attaquant fait avancer la `balance_revision` de la victime (1 → 3) |
| PostgreSQL — ordre d'exécution des triggers | Un trigger `BEFORE` qui lève interrompt l'instruction avant tout trigger `AFTER` : le même garde ferme la divulgation de nom et l'avancement de révision cross-tenant, sans toucher aux triggers existants |
| PostgreSQL — `pg_constraint` sur `public.transaction_tag` | `transaction_tag_transaction_id_fkey … ON DELETE CASCADE` : la suppression explicite des liens dans le RPC de suppression est redondante |

## Decisions

| Decision | Why |
| -------- | --- |
| Éditer `20260802120000_add_savings_goal_withdrawals.sql` en place plutôt qu'ajouter une migration correctrice | Aucune base n'a rejoué cette migration : `git branch -a --contains df18eddc5` ne renvoie que la branche PUL-329 et son miroir distant, et `preview` n'a aucun commit touchant ce fichier. C'est déjà la décision prise au round 1 sur ce même fichier ; en changer maintenant laisserait dans l'historique une migration correctrice d'une erreur qu'aucun environnement n'a vécue |
| Le garde de tenancy est un trigger `BEFORE`, pas une politique RLS ni une contrainte | Une contrainte `CHECK` ne peut pas lire une autre table, et la politique RLS d'`UPDATE` de `transaction` ne juge que le budget porteur. Le repo a déjà tranché deux fois de la même façon pour la même classe de faille : `20260701083300_enforce_savings_goal_line_tenant.sql` et `20260723120000_enforce_transaction_budget_line_coherence.sql`, ce dernier sur cette table. Un trigger couvre aussi les RPC `SECURITY DEFINER`, que la RLS ne voit pas |
| Le retrait cesse d'être filtré par une fenêtre de contribution, aux trois sites à la fois | Le retrait est un mouvement de **stock**, la fenêtre `isContributionEligible` / `isInHistoricalInterval` décrit un **flux**. Aujourd'hui la timeline utilise le garde large et le simulateur le garde étroit : un retrait avant l'ancre disparaît de la courbe, un retrait après l'échéance est compté par l'une et ignoré par l'autre. Corriger site par site multiplierait les gardes au lieu de retirer celui qui n'a pas lieu d'être |
| La propriété de fermeture reste vraie après le changement | `simulateFinal = initial + Σ_éligibles max(simulé, confirmé) − Σ_tous retraits` et `remaining = cible − initial − confirmé verrouillé + Σ_tous retraits − épinglés` : les deux sommes de retraits portent désormais sur le même ensemble, donc redistribuer puis simuler retombe exactement sur la cible. Les tests de fermeture existants échouent si ce n'est pas le cas |
