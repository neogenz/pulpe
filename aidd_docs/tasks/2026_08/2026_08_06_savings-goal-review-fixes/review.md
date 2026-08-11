# Review: Correctifs de la revue du retrait annoncé

- **Verdict**: approve
- **Diff**: `9e12e5f70...e50d63b14b00a956fbab735f2a3acea98af830c7`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_06
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — La source orpheline ne se déguise plus, et le détail dit d'où vient l'argent

- [x] Source orpheline → formulaire ordinaire, ni « Pris sur · … », ni « Montant restant prévu », ni solde — `budget-items-container.ts:671-672` (`if (!sourceSavingsGoalId || !sourceSavingsGoalName) return null`), consommé en 5ᵉ argument par `budget-items-container.ts:599` ; le bloc `realize-withdrawal-context` de `create-dialog/form.ts:102` est gardé par `data().withdrawalRealization`, donc absent quand le contexte est `null`
- [x] Source active → formulaire de réalisation inchangé — `budget-items-container.ts:678-682` renvoie le même triplet ; suite verte sur les cas actifs préexistants (`budget-items-container.spec.ts`, 67 tests passés avec les deux specs voisines)
- [x] Le panneau montre « Pris sur · <objectif> » ; l'objectif supprimé donne le libellé cassé et `link_off` sans couleur d'erreur — `budget-detail-panel.ts:128-139` lie `sourceSavingsGoalId` / `sourceName` ; les deux rendus sont prouvés sur le composant partagé, `savings-goal-source-line.spec.ts:34-58` (« Pris sur » + `savings` ; « Objectif supprimé » + `link_off` + `className` sans `error`)
- [x] Panneau d'une prévision sans source inchangé, aucune ligne vide ni espacement ajouté — le `@if` de `budget-detail-panel.ts:128` enveloppe le `<div class="mt-1">` entier ; `budget-detail-panel.spec.ts:208-214` constate l'absence du composant
- [x] `vitest` passe sur les deux specs, et chacun échoue si l'on remet la garde sur le nom ou si l'on retire la ligne — 67 tests verts ; `budget-items-container.spec.ts:760-775` utilise `sourceLine({ sourceSavingsGoalId: null })` qui **conserve** le nom (`budget-items-container.spec.ts:671`), donc l'ancienne garde produirait un contexte non-`null` et le test tomberait ; retirer la ligne du panneau casse `budget-detail-panel.spec.ts:189-194` (déréférencement de `source.nativeElement`) et `:203-205`

### Phase 2 — Le verrou de saisie du simulateur distingue ses deux champs

- [x] Un montant global négatif ferme « Appliquer », et ouvrir l'éditeur inline d'un mois ne le rouvre pas — `goal-plan-simulator-store.ts:64-66` (réunion des deux drapeaux) ; `goal-plan-timeline.ts:418-419` (`startEdit` → `#clearError`) n'atteint plus que `setMonthAmountInvalid` via `savings-goal-detail-page.ts:635` ; `goal-plan-simulator-store.spec.ts:232-240`
- [x] Corriger le montant global rouvre « Appliquer » immédiatement, sans toucher un mois — `goal-plan-simulator-toolbar.ts:255` écrit le seul drapeau global ; `goal-plan-simulator-store.spec.ts:252-262`
- [x] Le comportement d'un seul champ fautif est inchangé, les deux pris séparément — `goal-plan-simulator-store.spec.ts:218-227` (mois), `:242-250` (global) ; l'erreur locale de chaque champ reste chez lui (`goal-plan-timeline.ts:294` `hasEditError`, `goal-plan-simulator-toolbar.ts:219` `hasInputError`)
- [x] Quitter puis revenir en simulation repart sans refus en mémoire — `goal-plan-simulator-store.ts:312-314` remet les deux à `false` ; `enter()` / `exit()` / `revert()` passent tous par `#reset()` (`:183`, `:189`, `:194`) ; `goal-plan-simulator-store.spec.ts:264-273`
- [x] `vitest` passe sur `goal-plan-simulator-store.spec.ts` et les deux tests d'indépendance tombent sous un booléen unique — suite verte ; `:232-240` et `:242-250` posent un refus puis lèvent **l'autre** champ, ce qu'un drapeau partagé effacerait

### Phase 3 — Le contrat de mise à jour iOS perd son champ mort

- [x] `xcodebuild build -scheme PulpeLocal -configuration Local` compile — `EXIT=0`, aucune ligne `error:` ; `BudgetLine.swift:212-227` ne porte plus `checkedAt`
- [ ] La suite `PulpeTests` passe, encodage des DTO compris — suite **non exécutée** ; `build-for-testing` compile la cible de test (`EXIT=0`) et aucun site de test ne nomme le champ sur ce type (les 10 occurrences de `checkedAt` dans `PulpeTests/` portent sur `BudgetLine` / `Transaction`)
- [x] Éditer puis pointer produit les mêmes deux requêtes, sans 400 — aucun site n'écrivait `checkedAt` sur un `BudgetLineUpdate` (`EditBudgetLineSheet.swift:217-237`, seuls appelants, arguments nommés sans le champ) ; l'`Encodable` synthétisé omet `nil`, la clé était donc déjà absente du corps, et le pointage passe par sa propre route

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | code | 1 | `frontend/projects/webapp/src/app/feature/budget/budget-details/components/budget-grid/budget-detail-panel.spec.ts:180` | Aucun test ne verrait le panneau lier le **mauvais champ**. Les trois cas s'arrêtent à la présence du composant et à son `data-testid` : remplacer `[goalName]="sourceName"` par `envelope.data.name`, ou `[goalId]` par `null`, les laisse tous verts. La limite invoquée est réelle — sonde jetable sur le vrai `BudgetDetailPanel` : l'enfant est bien instancié mais `goalName()` et `goalId()` rendent leurs valeurs par défaut (`null`) et le rendu est vide (`<!--container-->`), ce que corroborent `signal-test-utils.ts` (contournement d'angular#54039 en zoneless) et les deux specs voisines qui s'arrêtent au même endroit (`edit-transaction-form.spec.ts:191`, `create-dialog/form.spec.ts:617`). Mais l'e2e ne comble pas le trou : `budget-details.page.ts:23,82` ne vise que `savings-goal-source-line` des cartes et de la table, jamais `detail-panel-source-goal-*`. | Assertion e2e sur `detail-panel-source-goal-<id>` à côté des deux lectures existantes de `budget-details.page.ts`, qui rendrait le nom lié observable. À défaut, acceptable en l'état : le liage est correct à la lecture et les deux états visuels sont tenus par `savings-goal-source-line.spec.ts:34-58`. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 92% (12/13) |
| Files checked | `shared/schemas.ts` (`budgetLineSchema` 892-893, `budgetLineUpdateSchema` 988-989), `backend-nest/supabase/migrations/20260805120000_add_planned_savings_goal_withdrawals.sql` (contraintes 27-39), `frontend/.../budget-details/{allocated-transactions/create-dialog/form.ts, components/budget-items-container.ts + .spec.ts, components/budget-grid/budget-detail-panel.ts + .spec.ts, components/budget-grid/budget-grid-card.ts, components/budget-table/cells/name-cell.ts, budget-line/{create,edit}/dialog.ts, store/budget-details-store.ts, components/edit-transaction-form/edit-transaction-form.ts}`, `frontend/.../savings-goals/detail/{savings-goal-detail-page.ts, components/goal-plan-simulator-toolbar.ts, components/goal-plan-timeline.ts, services/goal-plan-simulator-store.ts + .spec.ts}`, `frontend/.../ui/savings-goal-source/savings-goal-source-line.ts + .spec.ts`, `frontend/projects/webapp/src/app/testing/signal-test-utils.ts`, `frontend/e2e/pages/budget-details.page.ts`, `ios/Pulpe/Domain/Models/BudgetLine.swift`, `ios/Pulpe/Shared/Components/EditBudgetLineSheet.swift`, `ios/PulpeTests/**` |
| Unchecked     | Phase 3 CA2 — not-applicable : suite `PulpeTests` non exécutée (revue statique) ; la cible de test compile et retirer un champ ne peut qu'ôter une clé d'un encodage qui ne la portait déjà pas |
| Unplanned     | none — les 10 fichiers du diff sont tous nommés par une projection d'architecture de phase |
