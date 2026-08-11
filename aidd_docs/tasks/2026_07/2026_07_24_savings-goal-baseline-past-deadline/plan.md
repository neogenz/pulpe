---
objective: "Une prévision Épargne liée à un objectif n'est plus jamais posée sur une période postérieure à l'échéance de cet objectif."
status: implemented
---

# Plan: borner la baseline d'un objectif d'épargne à son échéance

## Overview

| Field      | Value                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Un objectif échéant en octobre 2026 ne doit produire ni prévision ni plan au-delà de la période d'octobre 2026.                                                          |
| **Source** | Régression reproduite sur données synthétiques : un objectif échéant en octobre générait encore des prévisions jusqu'en janvier suivant. |

## Diagnostic

`savings_goal.target_date` ne borne **aucune** écriture. Deux écrivains posent la prévision liée
sans plafond de période :

1. **Propagation à la création** — `CreateSavingsGoalUseCase.generateLinkedBaseline` →
   `TemplateLinePropagationAdapter` → `BulkTemplateLineOperationsUseCase.fetchPropagationBudgetIds`,
   qui retourne **tous** les budgets du Mois Type de période ≥ mois calendaire courant
   ([`supabase-budget-template.repository.ts:498`](../../../../backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.ts#L498)).
   L'utilisateur ayant des budgets matérialisés jusqu'à janvier 2027, la ligne a atterri dans les six.
2. **Génération mensuelle** — la RPC `create_budget_from_template` ne filtre que sur
   `sg.status = 'ACTIVE'`
   ([`20260720120000_reconcile_tag_and_goal_budget_generation.sql:50`](../../../../backend-nest/supabase/migrations/20260720120000_reconcile_tag_and_goal_budget_generation.sql#L50)).
   Tout budget créé plus tard, pour une période post-échéance, recopiera la ligne liée.

La suggestion mensuelle elle-même est juste et couvre les quatre périodes allant du mois courant à
l'échéance incluse.

**La timeline n'est pas le bug.** `buildSavingsGoalTimeline` étend délibérément l'horizon à toute
ligne liée (`rawEndIndex = Math.max(indexTarget, indexCurrent, ...lineIndices)`), comportement
verrouillé par un test existant
([`savings-goal-plan.spec.ts:141`](../../../../shared/src/calculators/savings-goal-plan.spec.ts#L141)). Elle
affiche fidèlement des lignes qui n'auraient jamais dû être écrites. Corriger l'affichage
masquerait le sur-engagement au lieu de le supprimer.

## Phases

| #   | Phase                                                    | File                         |
| --- | -------------------------------------------------------- | ---------------------------- |
| 1   | Borner la propagation à la création de l'objectif        | [`phase-1.md`](./phase-1.md) |
| 2   | Borner la génération mensuelle des budgets               | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                          | Verified                                                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/SAVINGS.md` §3.5                                          | L'auto-décomposition pose une `template_line` récurrente propagée aux budgets « courant+futurs » — aucune borne d'échéance n'est spécifiée.     |
| `docs/SAVINGS.md` §6                                            | La génération ne s'arrête que sur `status ≠ ACTIVE` ; une échéance dépassée laisse l'objectif `ACTIVE`, donc génératif.                        |
| `docs/SAVINGS.md` §10.1                                         | « Ton plan, mois par mois : timeline verticale de l'ancrage à l'échéance » — le contrat produit veut bien un plan borné à l'échéance.          |
| `docs/SAVINGS.md` §4.2 formule 5                                | `monthsRemaining = indexEcheance − indexCourant + 1`, échéance **incluse** — la borne est donc `≤ indexTarget`, pas `<`.                       |

## Decisions

| Decision                                                                                                        | Why                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corriger les deux écrivains, pas la timeline.                                                                   | La timeline étend son horizon aux lignes liées par contrat testé ; sans ligne post-échéance elle s'arrête d'elle-même à la cible. Borner l'affichage laisserait l'argent réellement engagé (4'155 pour une cible de 3'700).                              |
| La période cible est calculée en TypeScript (`getBudgetPeriodForDate`) ; la RPC reçoit une liste d'ids à exclure. | `payDayOfMonth` vit dans `auth.users.user_metadata`, illisible depuis une fonction SQL SECURITY INVOKER. Réimplémenter la règle quinzaine en PL/pgSQL dupliquerait une formule canonique de `shared/` et la ferait dériver. La RPC reste bête.            |
