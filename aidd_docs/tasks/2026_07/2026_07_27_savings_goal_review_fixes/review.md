# Review: Corrections de l’intervalle d’épargne

- **Verdict**: approve
- **Diff**: `0dcf7a517...aab32f22d`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_27
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Sécuriser les invariants shared et backend

- [x] Le cycle actif avant le jour de paie est propagé — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:344`.
- [x] Les bornes après jour de paie et sans préférence restent couvertes — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:314`.
- [x] Les opérations ordinaires et lignes non liées gardent leur contrat — `backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.spec.ts:373`.
- [x] Un snapshot exact de 121 IDs est accepté — `shared/src/savings-goal-schema.spec.ts:223`.
- [x] L’échéance et le nouveau lien hors horizon sont sérialisés — `backend-nest/src/modules/savings-goal/savings-goal-generation-stop.integration.spec.ts:439`.
- [x] Les écritures dans l’horizon, hors horizon et historiques sont distinguées — `backend-nest/src/modules/savings-goal/savings-goal-generation-stop.integration.spec.ts:492`.
- [x] Les contrôles propriétaire et kind restent centralisés — `backend-nest/supabase/migrations/20260727120000_enforce_savings_goal_link_horizon.sql:20`.
- [x] `initialAmount` initialise le premier cumul confirmé — `shared/src/calculators/savings-goal-plan.ts:151`.
- [x] Les autres cumuls et contributions restent invariants — `shared/src/calculators/savings-goal-plan.spec.ts:181`.
- [x] L’erreur Supabase n’est plus exposée dans `loggingContext` — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.spec.ts:1148`.
- [x] Shared, backend, intégration Supabase réelle et génération de types passent — 576 tests shared, 63 tests backend et 15 tests d’intégration.

### Phase 2 — Corriger l’orchestration Angular

- [x] Annuler la décision d’échéance n’écrit rien — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:589`.
- [x] Une erreur interrompt le flux avant toute seconde décision — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:702`.
- [x] Échéance puis statut sont traités séquentiellement — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:851`.
- [x] Refuser la seconde décision conserve le premier PATCH — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:662`.
- [x] La seconde décision utilise uniquement sa propre preview — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:615`.
- [x] Une preview vide n’ouvre pas de second dialogue — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:683`.
- [x] Le calcul visible est vérifié par le DOM public — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.spec.ts:25`.
- [x] L’E2E impose l’ordre strict des requêtes — `frontend/e2e/tests/features/savings-goals-progress.spec.ts:757`.
- [x] Type-check, 43 tests Angular ciblés et 15 scénarios Playwright passent sans retry.

### Phase 3 — Consolider et prouver les surfaces iOS

- [x] Le détail du Mois Type charge indépendamment du store auxiliaire — `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:33`.
- [x] La ligne libre reste utilisable et le lien s’enrichit après chargement — `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:36`.
- [x] Le détail utilise une seule `GoalProgressCard` — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:119`.
- [x] La cible et la projection conditionnelles sont rendues par la carte unique — `ios/Pulpe/Features/SavingsGoals/Components/GoalProgressCard.swift:50`.
- [x] SwiftLint strict et `pnpm quality` ne rapportent aucune violation.
- [x] Les quatre contrats cible/échéance vérifient présence et absence — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:18`.
- [x] Formulaire et détail passent en Dynamic Type accessibilité — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:131`.
- [x] La confirmation sombre garde ses montants et trois décisions — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:158`.
- [x] Les captures sont conservées dans le `.xcresult` — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift:278`.
- [x] Les 8 tests de l’intervalle passent sans réseau ni authentification — `SavingsGoalIntervalUITests`, 8/8.

### Phase 4 — Produire la preuve de merge cross-platform

- [x] Toutes les suites passent sur l’arbre exécutable `aab32f22d` — shared 576, backend 63, Supabase réel 15, Angular 43, Playwright 15, Swift 83, UI iOS 11 et build réussie.
- [x] Aucun résultat ne dépend d’un retry — Playwright exécuté avec `--retries=0`; XCTest final sans échec.
- [x] Le web est utilisable à 1440×900 et 390×844 — captures `/tmp/pulpe-web-savings-goal-desktop.png` et `/tmp/pulpe-web-savings-goal-mobile.png`.
- [x] iOS est utilisable en clair, Dynamic Type accessibilité et sombre — 12 captures extraites de `Test-PulpeUITests-2026.07.27_17-55-41-+0200.xcresult`.
- [ ] Publier des captures identifiées dans la PR — not-applicable, publication externe non autorisée.
- [ ] Fermer les 15 findings dans la PR — not-applicable, 13 findings locaux sont fermés; les 2 findings de publication exigent une action externe non autorisée.
- [ ] Joindre résultats et captures à la PR — not-applicable, commentaire ou upload externe non autorisé.
- [ ] Modifier le statut draft/ready de la PR — not-applicable, changement de statut externe non autorisé.

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 89.5% (34/38) |
| Files checked | 33 fichiers du diff `0dcf7a517...aab32f22d`, couvrant shared, backend, migration, Angular, iOS, tests et documentation |
| Unchecked | 4 critères de publication ou d’état de PR — not-applicable sans autorisation externe |
| Unplanned | none |
