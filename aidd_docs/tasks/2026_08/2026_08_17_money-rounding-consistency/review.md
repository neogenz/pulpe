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

- [x] Une égalité monétaire bruitée n'active ni dépassement, ni déficit, ni état « plan trop élevé » — `frontend/e2e/tests/features/envelope-overage-reste-impact.spec.ts:306`
- [x] Une différence de `0.01` active l'état attendu et s'affiche `0.01 CHF` ou `0,01 €` sur toute surface qui le justifie — `frontend/projects/webapp/src/app/feature/budget/budget-details/view-models/budget-item-constants.spec.ts:54`
- [x] Les agrégats ronds, reports secondaires et pourcentages conservent leur rendu compact actuel — `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-grid/budget-grid.spec.ts:132`
- [x] Le déficit affiché dans le mois, proposé dans le chip, copié dans le champ et envoyé par le formulaire est la même valeur au centime — `frontend/e2e/tests/features/savings-goal-withdrawals.spec.ts:392`
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

- [x] Web et iOS autorisent le plafond exact, bloquent `+0.01` et conservent le serveur comme autorité finale — `ios/PulpeTests/Shared/Components/SavingsGoalPickerFieldTests.swift:189`
- [ ] Une cible à `0.01` de son but n'est pas annoncée atteinte, même si son pourcentage visuel vaut 100 — le nouveau hero iOS arrondit encore le confirmé et la cible à l'unité ; `999.99 / 1000` devient visuellement `1'000 sur 1'000` — `ios/Pulpe/Features/SavingsGoals/Components/GoalHeroPresentation.swift:44`
- [ ] Tout manque, plafond ou projection qui guide une action montre jusqu'à deux décimales ; une valeur ronde reste sans décimales inutiles — le conseil iOS compare la projection brute et peut afficher « Vise 0 CHF/mois » pour un résidu sous-centime — `ios/Pulpe/Features/SavingsGoals/Components/GoalHeroPresentation.swift:129`
- [x] Les fixtures jumelles produisent le même verdict, la même valeur après retrait et le même payload normalisé sur les deux clients — `ios/PulpeTests/Shared/Components/SavingsGoalPlannedWithdrawalPickerTests.swift:132`

### Phase 6 — Prouver la non-régression transversale

- [x] Les trois parcours E2E échouent si un vrai centime disparaît, si une poussière crée un état ou si un montant affiché diffère du montant soumis — `frontend/e2e/tests/features/envelope-overage-reste-impact.spec.ts:259`<br>`frontend/e2e/tests/features/savings-goal-withdrawals.spec.ts:392`<br>`frontend/e2e/tests/features/savings-goals-progress.spec.ts:275`
- [x] Les résultats historiques du lissage, de la conversion FX, de la mensualité, des pourcentages et des agrégats intentionnellement compacts restent identiques — `shared/src/calculators/budget-formulas.spec.ts:173`
- [x] Builds, tests complets, qualité, E2E ciblés et suite iOS passent ; la suite iOS confirme explicitement qu'elle a exécuté des tests — `aidd_docs/tasks/2026_08/2026_08_17_money-rounding-consistency/browser-qa/qa.md:21`
- [x] Le diff ne contient ni dépendance, ni migration, ni modification du chiffrement ou des contrats de persistance — `backend-nest/src/modules/savings-goal/application/savings-goal-withdrawal-policy.service.ts:109`
- [x] CHF et EUR restent lisibles sur mobile, desktop et iOS ; visible et accessible annoncent la même valeur ; aucun état financier n'est justifié par zéro — `aidd_docs/tasks/2026_08/2026_08_17_money-rounding-consistency/browser-qa/qa.md:11`

## Findings

| Sev        | Kind       | Phase | Location                                                                                       | Issue                                                                                                                                                                                                   | Fix                                                                                                                                                                      |
| ---------- | ---------- | ----- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟡 warning | functional | 5     | `ios/Pulpe/Features/SavingsGoals/Components/GoalHeroPresentation.swift:44`<br>`ios/Pulpe/Features/SavingsGoals/Components/GoalHeroPresentation.swift:47` | Le nouveau hero iOS formate encore le montant confirmé et la cible en compact. À `999.99 / 1000`, il affiche `1'000 CHF sur 1'000 CHF` avec une barre à 100 %, alors que le domaine conserve correctement le centime manquant. | Utiliser `asAdaptiveCurrency` pour `amount` et `targetLine`, puis verrouiller `999.99 / 1000` dans `GoalHeroPresentationTests`.                                              |
| 🟡 warning | functional | 5     | `ios/Pulpe/Features/SavingsGoals/Components/GoalHeroPresentation.swift:129`                     | `makeRequiredPace` compare les `Decimal` bruts. Une projection `0.7999999999999999` face à `0.80` passe le garde alors que le domaine les juge égaux au centime, et le hero peut conseiller « Vise 0 CHF/mois ».       | Comparer `displayedProjection.rounded(2)` à `targetAmount.rounded(2)`, puis tester qu'un résidu sous-centime masque `requiredPace` tandis qu'un centime réel le conserve. |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 93% (25/27)                                                                                                                                                                                                                                                                                                    |
| Files checked | `origin/preview...HEAD` — 123 fichiers dans `shared/`, `backend-nest/`, `frontend/`, `ios/`, la documentation et les tâches AIDD                                                                                                                                                                               |
| Unchecked     | Phase 5 — le hero iOS masque le centime séparant confirmé et cible — fix<br>Phase 5 — le conseil de rythme iOS décide encore sur une comparaison brute — fix                                                                                                                                                  |
| Unplanned     | `DESIGN.md`, `frontend/DESIGN.md`, `frontend/.impeccable/design.json`, `ios/DESIGN.md` — rafraîchissement Impeccable demandé<br>`aidd_docs/tasks/2026_08/2026_08_17_forecast-overage-rounding/` — plan précurseur de PUL-335<br>`aidd_docs/memory/testing.md` — apprentissage QA demandé et approuvé |
