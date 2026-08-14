# Review: Retraits planifiés depuis un objectif d'épargne

- **Verdict**: changes-requested
- **Diff**: `preview (a6438ab4)...fix/savings-goal-qa-preview`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_06
- **Findings**: 0 critical, 2 warning, 2 minor

## Phases

### Phase 1 — Le simulateur web réagit pendant la saisie et refuse explicitement le négatif (A)

- [ ] Les tests échouent sur le comportement actuel (pas d'émission avant blur, négatif clampé) — ordre de rédaction non observable depuis le diff final ; les trois suites existent (`goal-plan-timeline.spec.ts:582`, `goal-plan-simulator-toolbar.spec.ts:329`, `goal-plan-simulator-store.spec.ts:193`)
- [x] `400` recalcule en direct ; `-500`, `-` et une valeur non finie affichent une erreur sans muter le plan — `goal-plan-timeline.ts:429` (`(input)` remplace `(blur)`), `goal-plan-timeline.spec.ts:582,593,607`
- [x] Le bouton suit la frappe ; `setMonth(-500)` / `setGlobalAmount(-500)` laissent le plan inchangé — `goal-plan-simulator-store.ts:23,187,197`, `goal-plan-simulator-store.spec.ts:193,204,216`

### Phase 2 — Le contrat « prévision provenant d'un objectif » et sa réalisation atomique (B)

- [x] Les schémas acceptent un revenu `one_off` source non pointé et refusent le reste — `shared/schemas.ts` (`budgetLineCreateSchema` superRefine), `planned-savings-goal-withdrawal-schema.spec.ts:25,45,59,71,84`
- [x] Un autre tenant est refusé ; la suppression nulle l'id et garde le nom snapshot — `20260805120000_add_planned_savings_goal_withdrawals.sql` (`enforce_budget_line_savings_goal_source`, `ON DELETE SET NULL`), `planned_savings_goal_withdrawals.sql:67,176`
- [x] La transaction allouée hérite de la source, débite atomiquement, solde insuffisant ne crée rien — `create-transaction.use-case.ts:73,119,198`, `planned_savings_goal_withdrawals.sql:219,249,277`
- [x] Pointer directement la prévision est refusé ; aucun double comptage — `toggle-budget-line-check.use-case.ts` (`assertNotAFakeRealization`), `toggle-budget-line-check.use-case.spec.ts:122`, `update-budget-line.use-case.ts` (`checkedAt` retiré du patch)

### Phase 3 — Projection et simulateurs cohérents entre TypeScript et Swift (B)

- [x] Le serveur fournit chaque prévision source et chaque retrait avec son `budgetLineId`, sans fuite inter-tenant — `savings-goal.repository` (`fetchPlannedWithdrawalRows`), `get-savings-goal-progress.use-case.ts`
- [x] Vecteurs 500/0 → −500 projeté ; 300 → −300 confirmé + −200 projeté ; 600 → aucun reliquat — `savings-goal-progress.ts:remainingPlannedWithdrawal`, `savings-goal-plan.spec.ts:1180,1190,1197,1204`
- [x] Timeline et redistribution aboutissent au même total, bord des 120 périodes inclus — `savings-goal-plan.spec.ts:1246,1264,1289,1321`
- [x] TS et Swift partagent les cas et les montants — `SavingsPlanCalculator.swift:simulate/redistribute` (`+ month.remainingPlannedWithdrawalAmount` aux deux sites), `SavingsPlanCalculatorWithdrawalTests.swift:173,208,229`

### Phase 4 — Ajout et réalisation de la prévision sur le web (B)

- [x] Les trois origines sont exclusives ; objectif + PUL-292 ou objectif + pointé insoumettables — `budget-line/create/dialog.ts` (`IncomeOrigin`, `setIncomeOrigin`, toggle « pointé » masqué)
- [x] Le picker montre la projection du mois sans bloquer une planification future ; le retrait réel reste strict — `savings-goal-picker-field.ts` (mode `plannedWithdrawal`, `hasInsufficientProjection` avertit, `isWithdrawalBlocked` inchangé en mode réel)
- [x] La ligne et l'édition rendent le nom complet, source non modifiable — `budget-grid-card.ts`, `budget-grid-mobile-card.ts`, `cells/name-cell.ts`, `budget-line/edit/dialog.ts` (lecture seule)
- [x] « Réaliser » crée une transaction allouée, conserve la saisie en cas de conflit, diminue le confirmé une seule fois — `allocated-transactions/create-dialog/dialog.ts` (`submit` awaité, fermeture sur `null` seulement), `budget-items-container.ts:682`

### Phase 5 — Une seule transition à l'ouverture d'un retrait — web (A)

- [ ] Le test échoue avant correctif — ordre de rédaction non observable depuis le diff final
- [x] Le clic mène au budget, l'URL ne porte plus `transactionId`, aucun dialogue ne s'ouvre seul — `savings-goal-withdrawals.spec.ts:245`
- [x] Plus aucune occurrence de `transactionId` comme paramètre de route — vérifié par grep sur `frontend/projects`, `frontend/e2e`
- [x] Diff net négatif, ni `shared/schemas.ts` ni backend — mesuré par la phase : `phase-8.md` (−81 lignes sur la piste A)

### Phase 6 — Ajout et réalisation de la prévision en SwiftUI (B)

- [x] Un ancien payload sans champs source se décode ; une création n'encode que l'id client — `BudgetLine.swift:32,172`, `BudgetLineSavingsGoalSourceTests.swift`
- [x] Les trois origines sont exclusives ; le mode objectif ne part jamais pointé ni en PUL-292 — `AddBudgetLineSheet+IncomeOrigin.swift` (`forbidsChecked`, `resetIncompatibleOriginState`), `AddBudgetLineSheet+Submit.swift:60`, `AddBudgetLineIncomeOriginTests.swift`
- [x] L'aperçu suit période et conversion, survit à l'erreur, ne bloque pas sur le solde actuel — `SavingsGoalPlannedWithdrawalPicker.swift:projection`, `SavingsGoalPlannedWithdrawalPickerTests.swift`
- [x] Réel alloué et jamais de toggle direct ; VoiceOver annonce l'intention ; un conflit ne ferme pas la page — `BudgetDetailsView+Routing.swift:handlePointGesture`, `PointCircle.swift:RealizeAffordance`, `AddAllocatedTransactionPage.swift:293` — VoiceOver vérifié à la source seulement (`phase-8.md`, B4.3)

### Phase 7 — Une seule transition à l'ouverture d'un retrait — iOS (A)

- [ ] Le test échoue avant correctif en constatant deux `push` — déclaré **Non tenu** par le plan lui-même ; le compilateur et le grep du critère 3 tiennent lieu de preuve
- [x] Un tap produit une seule transition ; le retour revient au même endroit — `AppState+Navigation.swift` (`case .transaction` supprimé), `BudgetDetailsRouterTests.swift`
- [x] Plus aucune occurrence du routeur transaction ni de `InitialTransactionPush` — vérifié par grep sur `ios/`
- [x] Diff net négatif, ni modèles ni services touchés — `BudgetDetailsView+Routing.swift` (−46), `MainTabView.swift` (−9), `AppState+Navigation.swift` (−4)

### Phase 8 — Portes de validation, deux gates distincts (A + B)

- [x] A1–A3 — défauts absents sur preview, rejeu mesuré dans le DOM — `phase-8.md`
- [x] A4 — piste A promouvable, sans migration ni champ de contrat, −81 lignes — `phase-8.md`
- [x] B1–B2 — portes ciblées puis globales ; partiel/dépassement prouvés numériquement — `phase-8.md`, `savings-goal-withdrawals.spec.ts:645`
- [x] B3–B4 — même sémantique web/iOS, retrait neutre conforme à `docs/SAVINGS.md` §7 — `phase-8.md` ; couverture non atteinte : device physique non rejoué (B4.1)
- [x] B5 — bloquants release et observations non bloquantes séparés — `phase-8.md` (7 observations, 2 couvertures non atteintes)

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | functional | 4 | `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-items-container.ts:669` | `#withdrawalRealizationContext` filtre sur `sourceSavingsGoalName`, pas sur `sourceSavingsGoalId` : sur une source **orpheline** (objectif supprimé), « Ajouter une transaction » ouvre un formulaire habillé en réalisation (« Pris sur · … », « Montant restant prévu »), que `resolveBudgetLineForAllocation` (`create-transaction.use-case.ts:177`) refuse systématiquement. La tâche 3.3 de la phase dit qu'une source orpheline « ne peut plus être réalisée » ; iOS applique déjà la règle (`AddAllocatedTransactionLogic.realizationPrefill` renvoie `nil` via `isPlannedSavingsWithdrawal`). | Aligner la garde sur l'id : `if (!budgetLine.sourceSavingsGoalId) return null;` — la ligne orpheline retombe alors sur le formulaire de transaction allouée ordinaire, comme le CTA (`budget-item-data-builder.ts:285`) et le geste de pointage (`budget-items-container.ts:690`) le font déjà. |
| 🟡 | fit | 4 | `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-grid/budget-detail-panel.ts:107` | Le panneau de détail d'une prévision (side-sheet ouvert par `budget-grid.ts:449`, tous types confondus) affiche l'objectif **alimenté** (`budget-detail-panel-linked-goal`) mais rien sur l'objectif **source**. La tâche 3.1 de la phase nomme « la ligne **et son panneau de détail** » ; iOS l'a fait (`BudgetLineDetailPage+SavingsGoalLink.swift:savingsGoalSourceLink`). Ouvrir un retrait annoncé depuis le desktop est donc la seule surface qui ne dit pas d'où vient l'argent. | Ajouter `<pulpe-savings-goal-source-line [goalId]="…" [goalName]="…" />` sous le bloc `linkedGoal`, comme dans `budget-grid-card.ts`. Le composant porte déjà l'état orphelin, aucun style à écrire. |
| 🟢 | code | 1 | `frontend/projects/webapp/src/app/feature/savings-goals/detail/services/goal-plan-simulator-store.ts:186` | `setAmountInvalid` est un booléen unique écrit par **deux** champs indépendants : le montant global de la toolbar et le champ inline d'un mois. Ouvrir l'éditeur d'un mois (`goal-plan-timeline.ts:419` → `#clearError()` → `invalidChange.emit(false)`) efface le refus que la toolbar affiche encore — « Appliquer » redevient actif alors qu'un `role="alert"` reste à l'écran, exactement le cas que le commentaire du verrou dit empêcher. | Donner au verrou sa source : `setAmountInvalid(source: 'global' \| 'month', isInvalid)` avec un `Set` des sources fautives, ou laisser chaque champ porter son drapeau et faire de `canApply` la conjonction des deux. |
| 🟢 | rot | 6 | `ios/Pulpe/Domain/Models/BudgetLine.swift:218` | `BudgetLineUpdate.checkedAt` n'a plus aucun site d'écriture, et `budgetLineUpdateSchema` l'`omit()` désormais sous `z.strictObject` : l'envoyer produirait un 400. Le champ contredit le commentaire voisin (`BudgetLineCreate:172`) qui explique justement pourquoi `BudgetLineUpdate` ne porte pas la source. | Supprimer la propriété. Le pointage passe par `PATCH /budget-lines/:id/check`, seul chemin que le serveur accepte encore. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 91% (29/32) |
| Files checked | `shared/schemas.ts`, `shared/src/calculators/savings-goal-{plan,progress}.ts` + specs, `backend-nest/supabase/migrations/20260805120000_add_planned_savings_goal_withdrawals.sql`, `backend-nest/supabase/tests/planned_savings_goal_withdrawals.sql`, `backend-nest/src/modules/{budget-line,transaction,savings-goal,budget}/**`, `frontend/.../budget-details/{budget-line/create,budget-line/edit,allocated-transactions/create-dialog,components/budget-grid,components/budget-table,view-models,components/budget-items-container.ts}`, `frontend/.../pattern/savings-goal-picker/savings-goal-picker-field.ts`, `frontend/.../savings-goals/detail/{services,components}`, `frontend/projects/webapp/public/i18n/fr.json`, `frontend/e2e/tests/features/savings-goal-withdrawals.spec.ts`, `ios/Pulpe/Domain/{Formulas,Models,Store}`, `ios/Pulpe/Features/Budgets/BudgetDetails/**`, `ios/Pulpe/Shared/Components/SavingsGoal*.swift`, `ios/PulpeTests/**`, `docs/SAVINGS.md` |
| Unchecked     | Phase 1 CA1 — not-applicable (ordre de rédaction non observable) ; Phase 5 CA1 — not-applicable (idem) ; Phase 7 CA1 — not-applicable (déclaré « Non tenu » par le plan, substitution documentée) |
| Unplanned     | Restauration du scroll au retour arrière desktop (`core/routing/page-viewport-scroller.ts`, `core/routing/index.ts`, `core/core.ts`) et couverture de dépôt des retraits (`2026_08_06_savings-goal-withdrawal-repo-coverage`) — les deux tracent vers leurs propres plans, chacun déjà revu (`review.md` voisins : `ship` et `approve`) |
