# Review: Corrections PUL-12/PUL-8 et provisioning de la redistribution

- **Verdict**: approve
- **Diff**: `f613af04a3ba5c11f89ffb2eb647d336ca098b53...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_13
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — Horizon et redistribution canoniques

- [x] Deux budgets sur 24 mois donnent 24 parts de 1 000 et une somme de 24 000 — `shared/src/calculators/savings-goal-plan.spec.ts:299`
- [x] Un budget absent est provisionnable et un budget existant sans ligne liée bloque la redistribution — `shared/src/calculators/savings-goal-plan.ts:154`, `shared/src/calculators/savings-goal-plan.spec.ts:331`
- [ ] Les anciens payloads avec `templateAdjustments: []` restent valides — transition supprimée en phase 5 et clé désormais rejetée par `shared/src/savings-goal-pul12.spec.ts:143`
- [x] La 121e période est rejetée et une échéance historique extrême produit au plus 120 mois — `shared/schemas.ts:256`, `shared/src/calculators/savings-goal-plan.ts:116`, `shared/src/calculators/savings-goal-plan.spec.ts:156`

### Phase 2 — Provisioning et intégrité backend

- [x] Le scénario 2/24 crée 22 budgets une fois et un retry réutilise les budgets liés sans reprovisionner — `backend-nest/src/modules/savings-goal/application/apply-savings-goal-plan.use-case.spec.ts:107`, `backend-nest/src/modules/savings-goal/application/apply-savings-goal-plan.use-case.spec.ts:254`
- [x] `/progress` distingue un budget absent provisionnable d'un budget existant non lié — `backend-nest/src/modules/savings-goal/application/get-savings-goal-progress.use-case.ts:46`, `backend-nest/src/modules/savings-goal/application/get-savings-goal-progress.use-case.spec.ts:173`
- [x] Une confirmation applique les 24 parts et la RPC finale reste atomique sur les montants — `backend-nest/src/modules/savings-goal/application/apply-savings-goal-plan.use-case.ts:89`, `backend-nest/supabase/migrations/20260713120000_harden_savings_goal_plan_apply.sql:41`
- [x] Toute ligne ajustée perd ses métadonnées FX source et conserve sa devise cible — `backend-nest/supabase/migrations/20260713120000_harden_savings_goal_plan_apply.sql:41`, `backend-nest/supabase/tests/apply_savings_goal_plan_guards.sql:72`
- [x] Lisser une Prévision Épargne liée conserve son `savingsGoalId` — `backend-nest/src/modules/budget-line/application/spread-budget-line-from-line.use-case.ts:49`, `backend-nest/src/modules/budget-line/application/spread-budget-line-from-line.use-case.spec.ts:378`

### Phase 3 — Cohérence, cache et accessibilité web

- [x] Le scénario 2/24 affiche 1 000 et produit 22 périodes à provisionner, y compris avec une répartition non uniforme aux centimes — `frontend/projects/webapp/src/app/feature/savings-goals/detail/services/goal-plan-simulator-store.spec.ts:184`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/services/goal-plan-simulator-store.spec.ts:235`
- [x] La suppression purge les caches et le picker; un échec restaure liste et sélection — `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.ts:144`, `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-store.spec.ts:198`
- [x] Loading, erreur et vide ont des rendus distincts; le retry recharge liste et progression — `frontend/projects/webapp/src/app/pattern/savings-goal-picker/savings-goal-picker-field.ts:39`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:638`
- [x] La carte est un lien clavier-safe et ses attributs n'exposent pas le nom — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-card.ts:33`, `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-card.spec.ts:47`
- [x] Le formulaire web refuse une échéance après la 120e période — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.ts:216`, `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.schema.spec.ts:43`

### Phase 4 — Parité, cache et formulaires iOS

- [x] Swift et TypeScript calculent les mêmes 24 parts et bloquent le même gap non provisionnable — `ios/Pulpe/Domain/Formulas/SavingsPlanCalculator.swift:83`, `ios/PulpeTests/Domain/Formulas/SavingsPlanCalculatorTests.swift:90`
- [x] Un override à 400 conserve la base globale à 250 et le slider reste utilisable — `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:379`, `ios/PulpeTests/Features/SavingsGoals/SavingsGoalDetailViewModelTests.swift:287`
- [x] Une suppression réussie invalide les quatre projections budget; un échec n'en invalide aucune — `ios/Pulpe/App/PulpeApp.swift:55`, `ios/Pulpe/Domain/Store/SavingsGoalStore.swift:104`
- [x] Une erreur de picker conserve la sélection et seule l'échéance historique exacte reste soumissible hors de la 120e période — `ios/Pulpe/Shared/Components/SavingsGoalPickerField.swift:16`, `ios/Pulpe/Features/SavingsGoals/SavingsGoalFormSheet.swift:79`, `ios/PulpeTests/Features/SavingsGoals/SavingsGoalFormSheetTests.swift:27`

### Phase 5 — Nettoyage du contrat et documentation

- [x] Le contrat final accepte les deux jambes actives et rejette `templateAdjustments` — `shared/schemas.ts:416`, `shared/src/savings-goal-pul12.spec.ts:143`
- [x] Les docs couvrent horizon, provisioning, atomicité, FX, lissage et deux pages iOS — `docs/SAVINGS_PLAN.md:88`, `docs/SAVINGS_PLAN.md:338`, `docs/SPREAD.md:80`, `aidd_docs/tasks/2026_07/2026_07_12_savings_goals_ios_intro/phase-1.md:67`
- [ ] Les tests ciblés, `pnpm quality` et `pnpm test` terminent avec un code 0 — non vérifiable par la revue statique; aucun artefact d'exécution dans le diff

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 minor | code | 2 | `backend-nest/src/modules/savings-goal/application/apply-savings-goal-plan.use-case.ts:66` | `execute` reste long et orchestre validation, provisioning, RPC, cache, recalcul et métriques. | Extraire la préparation du contexte ou la finalisation post-commit lors d'un refactor dédié. |

## Verification

| Metric | Value |
| ------ | ----- |
| Verified | 90% (19/21) |
| Files checked | `plan.md`, `phase-1.md` à `phase-5.md`, `shared/schemas.ts`, `shared/src/calculators/**`, `backend-nest/src/modules/{savings-goal,budget-line,budget}/**`, migration et tests SQL du plan, `frontend/**/savings-goals/**`, `frontend/**/savings-goal-picker/**`, `ios/Pulpe/**/SavingsGoal*`, `ios/PulpeTests/**/SavingsGoal*`, docs Savings/Spread |
| Unchecked | Phase 1 compatibilité temporaire `templateAdjustments` — fixed; Phase 5 sorties des gates — not-applicable |
| Unplanned | none |
