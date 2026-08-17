# Review: Money rounding consistency

- **Verdict**: changes-requested
- **Diff**: `origin/preview...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_17
- **Findings**: 0 critical, 2 warning, 0 minor

## Phases

### Phase 1 — Poser le contrat de comparaison monétaire au centime

- [x] `0.1 + 0.2` et `0.3` sont monétairement égaux ; aucun état ne peut naître de leur seule poussière binaire — `shared/src/money.spec.ts:5`
- [x] `58.55` comparé à `58.50` produit `0.05`, et l'ordre inverse produit `-0.05` — `shared/src/money.spec.ts:10`
- [x] La règle distingue sans ambiguïté décision au centime, affichage adaptatif et agrégat compact — `docs/BUSINESS_RULES.md:31`
- [x] Les tests partagés passent sans nouvelle dépendance et sans changement des résultats de lissage, de conversion ou de mensualité — `shared/src/calculators/budget-formulas.spec.ts:173`

### Phase 2 — Corriger les états budgétaires et les actions Web

- [ ] Une égalité monétaire bruitée n'active ni dépassement, ni déficit, ni état « plan trop élevé » — les dialogues colorent encore `remaining < 0` à partir de la soustraction flottante brute ; corriger le producteur central et tester le ton neutre — `frontend/projects/webapp/src/app/core/budget/budget-line-consumption.ts:43`
- [x] Une différence de `0.01` active l'état attendu et s'affiche `0.01 CHF` ou `0,01 €` sur toute surface qui le justifie — `frontend/projects/webapp/src/app/feature/budget/budget-details/view-models/budget-item-constants.spec.ts:54`
- [x] Les agrégats ronds, reports secondaires et pourcentages conservent leur rendu compact actuel — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-grid/budget-grid.spec.ts:132`
- [x] Le déficit affiché dans le mois, proposé dans le chip, copié dans le champ et envoyé par le formulaire est la même valeur au centime — `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line/savings-withdrawal/dialog.spec.ts:68`
- [x] Les tests Web ciblés couvrent les deux devises, le cas PUL-335, un vrai petit déficit et un résidu IEEE-754 sans état parasite — `frontend/projects/webapp/src/app/ui/dashboard-hero/dashboard-hero.spec.ts:127`

### Phase 3 — Aligner les états budgétaires iOS et les formules miroirs

- [x] Un résidu inférieur au centime n'altère ni `isDeficit`, ni le ton, ni la visibilité de la carte de retrait — `ios/PulpeTests/Domain/Formulas/BudgetFormulasExtendedTests.swift:365`
- [x] Un déficit ou dépassement réel de `0.01` reste visible et porte le même état dans Accueil, la liste des budgets et le détail — `ios/PulpeTests/Features/Budgets/BudgetDetails/BudgetLinePresentationTests.swift:76`
- [x] Les valeurs entières restent compactes ; les libellés accessibles et visibles annoncent la même valeur — `ios/PulpeTests/Features/Budgets/BudgetListAccessibilityTests.swift:76`
- [x] Les fixtures `58.50 / 58.55` et d'égalité sont présentes sur Web et iOS avec le même verdict — `ios/PulpeTests/Features/CurrentMonth/HomeHeroCardTests.swift:27`

### Phase 4 — Sécuriser les décisions métier des objectifs et retraits

- [x] Le retrait du solde exact est accepté ; le même montant augmenté de `0.01` est refusé sans mutation partielle — `backend-nest/src/modules/savings-goal/application/apply-savings-goal-plan.use-case.spec.ts:212`
- [x] Un retrait planifié entièrement réalisé laisse exactement zéro de reliquat et ne gonfle ni projection ni redistribution — `shared/src/calculators/savings-goal-progress.spec.ts:145`
- [x] Une cible couverte au centime est atteinte ; une cible à laquelle il manque `0.01` ne l'est pas, même si le pourcentage affiché vaut 100 — `shared/src/calculators/savings-goal-progress.spec.ts:383`
- [x] `gapToTarget`, `isTargetMet`, `attainedPeriod` et l'effort redistribué ont les mêmes résultats dans les fixtures TypeScript et Swift — `shared/src/calculators/savings-goal-plan.spec.ts:438`
- [x] Aucun fichier de migration, schéma, DTO ou chiffrement n'est modifié — `backend-nest/src/modules/savings-goal/application/savings-goal-withdrawal-policy.service.ts:109`

### Phase 5 — Aligner les parcours objectifs et retraits sur les deux clients

- [x] Web et iOS autorisent le plafond exact, bloquent `+0.01` et conservent le serveur comme autorité finale — `frontend/projects/webapp/src/app/pattern/savings-goal-picker/savings-goal-picker-field.spec.ts:300`
- [x] Une cible à `0.01` de son but n'est pas annoncée atteinte, même si son pourcentage visuel vaut 100 — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:1289`
- [x] Tout manque, plafond ou projection qui guide une action montre jusqu'à deux décimales ; une valeur ronde reste sans décimales inutiles — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-apply-dialog.spec.ts:139`
- [x] Les fixtures jumelles produisent le même verdict, la même valeur après retrait et le même payload normalisé sur les deux clients — `ios/PulpeTests/Features/SavingsGoals/SavingsGoalDetailViewModelTests.swift:419`

### Phase 6 — Prouver la non-régression transversale

- [ ] Les trois parcours E2E échouent si un vrai centime disparaît, si une poussière crée un état ou si un montant affiché diffère du montant soumis — le troisième scénario teste un retrait planifié de `500 CHF` refusé pour un stock de `499.99 CHF`, pas le déficit budgétaire affiché, prérempli puis soumis ; ajouter ce parcours E2E — `frontend/e2e/tests/features/savings-goal-withdrawals.spec.ts:931`
- [x] Les résultats historiques du lissage, de la conversion FX, de la mensualité, des pourcentages et des agrégats intentionnellement compacts restent identiques — `shared/src/calculators/budget-formulas.spec.ts:173`
- [x] Builds, tests complets, qualité, E2E ciblés et suite iOS passent ; la suite iOS confirme explicitement qu'elle a exécuté des tests — `aidd_docs/tasks/2026_08/2026_08_17_money-rounding-consistency/browser-qa/qa.md:21`
- [x] Le diff ne contient ni dépendance, ni migration, ni modification du chiffrement ou des contrats de persistance — `backend-nest/src/modules/savings-goal/application/savings-goal-withdrawal-policy.service.ts:109`
- [x] CHF et EUR restent lisibles sur mobile, desktop et iOS ; visible et accessible annoncent la même valeur ; aucun état financier n'est justifié par zéro — `aidd_docs/tasks/2026_08/2026_08_17_money-rounding-consistency/browser-qa/qa.md:11`

## Findings

| Sev        | Kind       | Phase | Location                                                                                                                                                                                                                                                                                                                           | Issue                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                         |
| ---------- | ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 warning | functional | 2     | `frontend/projects/webapp/src/app/core/budget/budget-line-consumption.ts:43`<br>`frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/details-dialog/bottom-sheet.ts:142`<br>`frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/details-dialog/dialog.ts:130` | `remaining` conserve la poussière de la soustraction brute. Les deux dialogues utilisent ensuite son signe pour activer `text-error`, même lorsque le message adaptatif conclut à une égalité monétaire et affiche zéro. | Calculer `remaining` avec `moneyDifference(budgetLine.amount, consumed)` dans le producteur partagé, puis ajouter une régression qui vérifie aussi l'absence du ton d'erreur pour `0.3` face à `0.1 + 0.2`. |
| 🟡 warning | functional | 6     | `frontend/e2e/tests/features/savings-goal-withdrawals.spec.ts:931`                                                                                                                                                                                                                                                                 | Le scénario annoncé comme preuve de cohérence affichage/saisie/payload couvre un retrait planifié de `500 CHF` face à un stock de `499.99 CHF`. Il ne couvre pas l'action de récupération d'un petit déficit budgétaire. | Ajouter un E2E avec un restant de `-0.30`, ouvrir « couvrir avec l'épargne », vérifier `0.30` dans le résumé et le champ, puis vérifier `0.30` dans la requête soumise.                                     |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 93% (25/27)                                                                                                                                                                                                                                                                                                    |
| Files checked | `origin/preview...HEAD` — 120 fichiers dans `shared/`, `backend-nest/`, `frontend/`, `ios/`, la documentation et les tâches AIDD                                                                                                                                                                               |
| Unchecked     | Phase 2 — l'égalité bruitée peut encore activer le ton d'erreur des dialogues — fix<br>Phase 6 — le parcours E2E déficit affiché/prérempli/soumis manque — fix                                                                                                                                                 |
| Unplanned     | `DESIGN.md`, `frontend/DESIGN.md`, `frontend/.impeccable/design.json`, `ios/DESIGN.md` — rafraîchissement Impeccable mené en parallèle<br>`aidd_docs/tasks/2026_08/2026_08_17_forecast-overage-rounding/` — plan précurseur de PUL-335<br>`aidd_docs/memory/testing.md` — apprentissage QA demandé et approuvé |
