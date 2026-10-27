---
objective: "L'aperçu de suppression d'un objectif répond de nouveau et expose ses retraits, un conflit de verrous sort en 409 rejouable au lieu d'un 500 opaque, et les triggers de révision ne coûtent plus rien aux écritures qui ne touchent aucun objectif."
status: implemented
---

# Plan: correctifs de revue PUL-329

## Overview

| Field      | Value                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| **Goal**   | Fermer les trois constats de la revue du diff PUL-329 sans anticiper les phases 3 à 6 du plan parent |
| **Source** | [`../2026_08_02_savings-goal-withdrawals/review.md`](../2026_08_02_savings-goal-withdrawals/review.md) — verdict `changes-requested` |

## Phases

| #   | Phase                                             | File                         |
| --- | ------------------------------------------------- | ---------------------------- |
| 1   | Réparer l'aperçu de suppression et son contrat    | [`phase-1.md`](./phase-1.md) |
| 2   | Traduire le conflit de verrous en 409 rejouable   | [`phase-2.md`](./phase-2.md) |
| 3   | Alléger les triggers et pinner le contrat SQL     | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                | Verified                                                                                                                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL — CREATE TRIGGER, clause `WHEN`                             | Un `WHEN` référençant `OLD` est refusé à la création pour un trigger couvrant INSERT (`ERROR: INSERT trigger's WHEN condition cannot reference OLD values`, reproduit sur PostgreSQL 17.6). Le garde doit vivre dans le corps de la fonction |
| PostgreSQL — PL/pgSQL trigger procedures                               | Dans un trigger `FOR EACH ROW`, l'enregistrement absent est un record NULL et la lecture d'un de ses champs renvoie NULL : une seule expression booléenne couvre INSERT, UPDATE et DELETE |
| PostgreSQL — appendix A, class 40 (`40P01 deadlock_detected`)          | Une inversion d'ordre de verrous est arbitrée par le détecteur, qui annule intégralement une des deux transactions : le rollback est acquis, seul le rejeu manque |

## Decisions

| Decision                                                                                                   | Why                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Éditer `20260802120000_add_savings_goal_withdrawals.sql` en place plutôt qu'ajouter une migration correctrice | L'interdit de `supabase.md` protège une migration déjà rejouée par une base : ici aucune. La branche n'a pas d'upstream, `git branch -a --contains eecd56331` ne renvoie que le local, `preview` ne la contient pas. Le repo amende ses migrations non mergées (`67c3fbb60` a réécrit `20260726122000` après revue). Une seconde migration qui `CREATE OR REPLACE` une fonction créée par sa voisine non mergée ne documenterait qu'une erreur qu'aucun environnement n'a vécue |
| Le garde-fou anti-dérive vit dans `savings-goal.integration.spec.ts`, pas seulement dans le harnais SQL      | Ce spec appelle déjà la vraie fonction SQL et tourne en CI (`ci.yml:342`, Supabase migrée). Remplacer son `as unknown as DeletionImpactPayload` par un `savingsGoalDeletionImpactRpcSchema.parse(data)` fait échouer la CI à la prochaine dérive producteur/consommateur. Les fichiers `supabase/tests/*.sql` ne sont câblés à aucun job et ne se lancent qu'à la main |
| `savingsGoalWithdrawalSchema.amount` passe de `.positive()` à `.nonnegative()`                               | Le chemin de lecture déchiffre avec le fallback maison `tryDecryptAmount(x, dek, 0)`. Avec `.positive()`, un seul ciphertext illisible ferait échouer `savingsGoalDeletionImpactSchema.parse` et donc tout l'aperçu — au moment précis où l'utilisateur a besoin de voir l'intégralité de ce qu'il s'apprête à supprimer. Les trois montants frères du même payload sont déjà `.nonnegative()` |
| Le 40P01 se traduit en `CONCURRENT_MODIFICATION` (409) et non en un des trois codes PUL-329                  | `SAVINGS_GOAL_WITHDRAWAL_CONFLICT` désigne le désaccord de révision levé par `lock_savings_goal_for_withdrawal`, pas un arbitrage de verrous. `CONCURRENT_MODIFICATION` existe déjà, porte un slot `{ resource }` et vaut 409 : le client sait qu'il peut rejouer. Aucune nouvelle entrée `ERROR_DEFINITIONS` |
