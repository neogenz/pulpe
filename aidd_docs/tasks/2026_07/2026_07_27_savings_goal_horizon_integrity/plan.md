---
objective: "Les deux incohérences d’écriture à impact réel sur l’horizon d’un objectif d’épargne sont fermées sans modifier les contrats clients ni les migrations existantes."
status: implemented
---

# Plan: Fermer les incohérences d’horizon à valeur réelle

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Sérialiser tout avancement d’échéance et permettre de relier une prévision Mois Type existante à un objectif daté sans dépasser son horizon. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_27_savings_goal_review_fixes/review.md`, parcours backend/web/iOS et `docs/SAVINGS.md`. |
| **Included** | Le contournement de la RPC quand la preview est vide ; l’ignorance de `excluded_budget_ids` lors de la propagation d’une ligne Mois Type mise à jour. |
| **Excluded** | La borne payDay-aware au 120e cycle : bug réel mais limité à la borne exacte de dix ans et correction disproportionnée sur quatre couches. La nouvelle date passée via API : les apps la refusent déjà et le schéma UPDATE la tolère volontairement pour préserver les objectifs historiques. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Sérialiser les changements d’échéance | [`phase-1.md`](./phase-1.md) |
| 2 | Borner le nouveau lien propagé depuis le Mois Type | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://www.postgresql.org/docs/18/explicit-locking.html | `FOR KEY SHARE` ne bloque pas un UPDATE non-clé ; `FOR SHARE` le bloque, et la RPC existante utilise déjà `FOR UPDATE` pour recalculer son snapshot sous verrou. |

## Decisions

| Decision | Why |
| --- | --- |
| Réutiliser `reconcile_savings_goal_target_date` avec un snapshot interne vide quand aucune candidate n’est visible, sans relâcher le `.min(1)` du contrat client. | La RPC sait déjà recalculer les candidates sous verrou ; aucun second mécanisme atomique n’est nécessaire. |
| Remplacer les fonctions SQL concernées uniquement par de nouvelles migrations additives. | Les migrations du dépôt sont immuables ; les signatures publiques restent inchangées et la régénération des types ne doit produire aucun diff. |
| Dans un budget exclu, préserver le `savings_goal_id` déjà stocké tout en propageant les autres champs de la ligne Mois Type. | Une nouvelle association ne doit pas franchir l’échéance, mais une occurrence historique ou son montant ne doit pas être réécrit implicitement. |
| Ne pas corriger les deux findings exclus dans cette itération. | Leur impact utilisateur observé ne justifie ni une rupture du contrat API ni une synchronisation cross-platform de la borne extrême. |
