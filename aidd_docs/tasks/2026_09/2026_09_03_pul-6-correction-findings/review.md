# Review: PUL-6 — Corriger les findings de review

- **Verdict**: approve
- **Diff**: `7a22f34c55d8dc9c217089670a4e093b8bde5bd7...9f2469123995b196c48434c222d45597a8cda8bc`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_03
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Garantir la compensation backend

- [x] Après un échec de recalcul, la suppression de tous les budgets créés précède l'invalidation faillible et l'erreur initiale reste la cause métier — `backend-nest/src/modules/budget/application/generate-budgets.use-case.ts:70`
- [x] La suite Bun verrouille l'ordre rollback/cache, la cause initiale et les IDs orphelins — `backend-nest/src/modules/budget/application/generate-budgets.use-case.spec.ts:157`

### Phase 2 — Rendre la validation et la fermeture Web explicites

- [x] Les deux dialogues consomment l'unique fabrique de formats mois/année, testée pour CHF et EUR — `frontend/projects/webapp/src/app/core/date/date-display-formats.ts:43`, `frontend/projects/webapp/src/app/feature/budget/budget-list/create-budget/budget-creation-dialog.ts:48`, `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:59`
- [x] Tout rejet résiduel du schéma partagé devient une erreur localisée annoncée et bloque l'appel — `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:215`, `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.spec.ts:149`
- [x] Annuler, backdrop et Escape sont bloqués pendant la mutation, puis restaurés sur erreur; le succès ferme avec le résultat — `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:155`, `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.ts:280`, `frontend/projects/webapp/src/app/feature/budget/budget-list/plan-budgets/plan-budgets-dialog.spec.ts:181`

### Phase 3 — Bloquer les sorties mobiles pendant la génération

- [x] iOS bloque le bouton et le geste de fermeture sur la vraie sheet pendant toute la requête, les rétablit après erreur et conserve refresh/annonce sur succès — `ios/Pulpe/Features/Budgets/BudgetList/PlanBudgetsView.swift:50`, `ios/Pulpe/Features/Budgets/BudgetList/PlanBudgetsView.swift:65`, `ios/PulpeUITests/PlanBudgetsPendingDismissUITests.swift:5`, `ios/Pulpe/Features/Budgets/BudgetList/BudgetListView.swift:66`
- [x] Android partage `generate.isPending` entre Appbar et retour matériel, nettoie l'abonnement et conserve navigation/compteurs sur succès — `android/src/app/(main)/budget/plan.tsx:74`, `android/src/app/(main)/budget/plan.tsx:110`, `android/src/app/(main)/budget/plan.tsx:83`, `android/src/features/budgets/plan-budget-screen.spec.tsx:286`

### Phase 4 — Nettoyer les dérives documentaires

- [x] Le README reflète les 16 signatures exposées et les 10 fonctions invoker du test SQL — `backend-nest/supabase/tests/README.md:34`, `backend-nest/supabase/tests/security_definer_function_privileges.sql:12`
- [x] Le diff du workflow reste limité au scénario PUL-6 et conserve défaut payDay-aware, plage inclusive, skips et compteurs — `docs/BUSINESS_WORKFLOW.md:127`

### Phase 5 — Tolérer la concurrence avec la création simple

- [x] Le sous-bloc PL/pgSQL transforme le conflit concurrent de période en skip puis continue les autres mois — `backend-nest/supabase/migrations/20260901120000_generate_budgets_atomically.sql:90`, `backend-nest/supabase/tests/generate_budgets_atomically.sql:150`
- [x] Seule `unique_month_year_per_user` est absorbée; toute autre unicité est relancée et les invariants de rollback/verrou/ordre restent couverts — `backend-nest/supabase/migrations/20260901120000_generate_budgets_atomically.sql:99`, `backend-nest/supabase/tests/generate_budgets_atomically.sql:163`, `backend-nest/supabase/tests/generate_budgets_atomically.sql:175`

### Phase 6 — Réconcilier la branche avec main et valider

- [x] Le merge additif conserve les contrats PUL-6 et feedback, sans marqueur de conflit, avec `origin/main` ancêtre du candidat — `shared/schemas.ts:212`, `shared/schemas.ts:2618`, `backend-nest/src/types/database.types.ts:608`, `backend-nest/src/types/database.types.ts:944`, `ios/Pulpe/Core/Network/Endpoints.swift:28`, `ios/Pulpe/Core/Network/Endpoints.swift:94`
- [x] Les preuves fournies couvrent Backend, SQL, Web, Android, iOS, architecture, qualité et le XCUITest final; le candidat poussé correspond à `HEAD` et l'arbre était propre avant ce rapport — `aidd_docs/tasks/2026_09/2026_09_03_pul-6-correction-findings/phase-6.md:66`

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (13/13) |
| Files checked | 77 fichiers de `origin/main...9f2469123`, dont plans PUL-6, contrats `shared`, backend/Nest/Supabase, Web, iOS, Android et documents; preuves fournies: Backend 4/4, SQL assertions, Web 15/15, Android 5/5, tests iOS ciblés, architecture 506/0, `pnpm quality` 0 erreur et XCUITest final |
| Unchecked | none |
| Unplanned | none |
