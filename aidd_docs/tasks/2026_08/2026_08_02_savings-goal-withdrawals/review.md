# Review: savings-goal-withdrawals (PUL-329)

- **Verdict**: approve
- **Diff**: `f075d7567...357736191`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_03
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Figer le contrat métier et les formules de progression

- [x] Une création de revenu peut porter exactement un `sourceSavingsGoalId`; un PATCH ne peut ni fournir ni effacer ce champ. — `shared/schemas.ts:1387`
- [x] Les contrats distinguent sans ambiguïté un lien actif, un lien cassé et une transaction ordinaire. — `shared/schemas.ts:1344-1352`
- [x] Pour 10'000 CHF confirmés et 4'500 CHF retirés, `confirmed` et la projection partent de 5'500 CHF. — `shared/src/calculators/savings-goal-progress.ts:317`
- [x] La contribution mensuelle confirmée et le plan futur sont strictement identiques avant et après le retrait. — `shared/src/calculators/savings-goal-progress.ts:317`
- [x] Un retrait apparaît dans le bon cycle budgétaire selon le jour de paie, sans être compté comme une contribution négative. — `shared/src/calculators/savings-goal-progress.ts:314-316`
- [x] Un retrait compte quel que soit le mois où il tombe — avant l'ancre de contribution comme sur un mois fermé — donc le cumul de la timeline ne diverge jamais du solde affiché. — `shared/src/calculators/savings-goal-plan.ts:209,352,440`
- [x] Les tests échouent si un retrait augmente le solde, modifie le rythme ou devient éditable par le contrat PATCH. — `shared/src/calculators/savings-goal-progress.spec.ts:827,941`
- [x] La propriété de fermeture tient : redistribuer puis simuler retombe sur la cible même quand le retrait est hors de la fenêtre de contribution. — `shared/src/calculators/savings-goal-plan.spec.ts:1063`, miroir `ios/PulpeTests/Domain/Formulas/SavingsPlanCalculatorWithdrawalTests.swift:120`
- [x] `docs/SAVINGS.md` permet de distinguer le retrait permanent d'un objectif du mécanisme avec remboursement PUL-292. — `docs/SAVINGS.md:425`

### Phase 2 — Poser le modèle PostgreSQL et les mutations atomiques

- [x] Une transaction liée ne peut exister qu'en revenu libre avec un snapshot non vide ; une transaction ordinaire conserve les deux champs à null. — `backend-nest/supabase/migrations/20260802120000_add_savings_goal_withdrawals.sql:21-34`
- [x] La base ne contient aucun nouveau montant financier en clair. — `…20260802120000_add_savings_goal_withdrawals.sql:14`
- [x] Un revenu ne peut désigner que l'objectif de son propre propriétaire ; ni la recopie de nom ni l'avancement de révision ne franchissent la frontière de locataire. — `…20260802120000_add_savings_goal_withdrawals.sql:52-95`
- [x] Toute mutation committée pouvant changer le stock ou sa chronologie rend une révision précédemment lue invalide ; les conflits de verrou sont rollbackés puis rejouables. — `…20260802120000_add_savings_goal_withdrawals.sql:178-279`
- [x] Deux écritures portant la même révision ne peuvent pas toutes les deux réussir. — `backend-nest/supabase/tests/savings_goal_withdrawal_atomicity.sql:230`
- [x] Une erreur d'écriture des tags annule aussi la transaction et l'avancement de révision. — `backend-nest/supabase/tests/savings_goal_withdrawal_atomicity.sql:261`
- [x] Après renommage puis suppression, le revenu existe encore, `source_savings_goal_id` vaut null et le dernier nom reste disponible. — `backend-nest/supabase/tests/savings_goal_withdrawal_atomicity.sql:385`
- [x] Les modes de suppression qui retirent des transactions allouées ne retirent jamais les revenus provenant de l'objectif. — `…20260802120000_add_savings_goal_withdrawals.sql:622-625`
- [x] Les tests SQL couvrent concurrence, ownership, tenancy, contraintes et rollback sur une base locale migrée sans commande destructive. — 21 assertions, `backend-nest/supabase/tests/savings_goal_withdrawal_atomicity.sql:86-767`

### Phases 3 à 6 — Backend applicatif, API, webapp, iOS

- [ ] Hors périmètre de ce diff — `status: pending` assumé dans `plan.md`, aucun code livré. Non compté comme finding.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |

None.

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (18/18) |
| Files checked | `backend-nest/supabase/migrations/20260802120000_add_savings_goal_withdrawals.sql`, `backend-nest/supabase/tests/savings_goal_withdrawal_atomicity.sql`, `shared/schemas.ts`, `shared/src/calculators/savings-goal-progress.ts`, `shared/src/calculators/savings-goal-plan.ts`, `shared/src/calculators/savings-goal-progress.spec.ts`, `shared/src/calculators/savings-goal-plan.spec.ts`, `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts`, `ios/Pulpe/Domain/Formulas/SavingsPlanCalculator.swift`, `ios/Pulpe/Domain/Models/SavingsGoalPlan.swift`, `ios/PulpeTests/Domain/Formulas/SavingsPlanCalculatorWithdrawalTests.swift`, `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift`, `docs/SAVINGS.md` |
| Unchecked     | none |
| Closed depuis la revue précédente | Tenancy `transaction.source_savings_goal_id` → trigger `enforce_transaction_savings_goal_source` (`92f36729f`), prouvé par les assertions 20-21 et par la mise en rouge de l'assertion 20 quand le trigger est retiré. Retrait ignoré hors fenêtre → garde supprimé aux trois sites et miroir Swift (`18555b68d`), chaque décision prouvée en la révertant une à une. Formule `cumulativeGap` périmée (`docs/SAVINGS.md:194`, `:343`) et tâche 3.6 inapplicable (`d3dc47f8b`). Formule du restant à redistribuer périmée (`docs/SAVINGS.md:367`, plus deux commentaires miroirs) — seul survivant de la revue adverse round 3, levé indépendamment par deux lentilles (`eb547aa69`). Instructions mortes de `delete_savings_goal_withdrawal` → `ON DELETE CASCADE` (`92f36729f`), contrôle rendu non vacué (`357736191`). |
| Réfuté en revue adverse | Divergence de parité TS/Swift à `savings-goal-plan.ts:162` (préexistante : les deux révisions rendent des résultats identiques au bit près) ; surinterprétation du commentaire de l'assertion 20 ; `FAIL` prétendument inatteignable de l'assertion 21 (un mutant le fait tirer) ; cascade des tags non prouvée (FK basculée en `NO ACTION` → l'assertion 10 meurt) ; `input.withdrawals ?? []` côté backend (aucun producteur, pas de divergence atteignable) ; §10.2 `docs/SAVINGS.md:352` (l'énoncé porte sur les lignes de contribution, et il reste vrai pour elles). |
| Unplanned     | Trois codes d'erreur encore sans portée runtime ; schémas option/retrait ; `withdrawalCount`/`withdrawalTotal`/`withdrawals[]` par défaut sur l'aperçu de suppression ; champs de fil `withdrawnAmount`/`withdrawn` ; annulation de `attainedPeriod` quand la cible n'est plus atteinte en fin de simulation, changement de comportement du simulateur préexistant ; `GRANT EXECUTE` à `authenticated`, conforme aux RPC d'objectif déjà livrées, le plafond « ne jamais retirer plus que le confirmé » restant porté par le backend ; refactor de `throwGenerationStopRpcError` et extraction de `sumAmounts` dans `supabase-savings-goal.repository.ts` ; `savings-goal.integration.spec.ts:284-296` parse désormais la sortie RPC réelle |
