# Review: Rejet d'un rattachement d'épargne hors échéance

- **Verdict**: changes-requested
- **Diff**: `preview...claude/savings-after-end-date-bug-2f60ce`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_02
- **Findings**: 0 critical, 3 warning, 4 minor

## Phases

### Phase 1 — Le refus horizon devient un 422

- [x] Avant correction, les deux nouveaux tests échouent en signalant un 500 — sans le bloc ajouté, le `P0001` retombe sur `BUDGET_LINE_CREATE_FAILED` / `..._UPDATE_FAILED`, ce que les tests refusent (`supabase-budget-line.repository.spec.ts:379`, `:758`)
- [x] Créer une prévision d'épargne hors échéance renvoie 422 `ERR_SAVINGS_GOAL_LINE_OUTSIDE_HORIZON` — `supabase-budget-line.repository.ts:331`
- [x] Modifier une prévision existante renvoie le même 422 — `supabase-budget-line.repository.ts:720` et `tag-links.util.ts:202` (chemin RPC taggé, celui du dialogue web)
- [x] Un objectif supprimé ou d'un autre utilisateur renvoie toujours `ERR_SAVINGS_GOAL_NOT_FOUND` — branche `isSavingsGoalLinkDenied` intacte et testée sur un message distinct (`savings-goal-link.ts:37-39`)
- [x] Le chemin lissage renvoie toujours son 422 — garde du lissage non touchée, `api-error-localizer.spec.ts:50` couvre toujours le code

### Phase 2 — Le message atteint l'utilisateur

- [x] La formulation vaut pour une ligne unique comme pour un lissage et cite une action — `fr.json:1419`, `APIError.swift:125`
- [x] Web et iOS affichent une formulation identique — chaînes strictement égales
- [x] Un ajout refusé laisse le budget affiché — `budget-details-store.ts:593` remplace `#setError` par la valeur de retour, `budget-details-page.ts:248` la toaste
- [ ] La carte « Impossible de charger ton budget » n'apparaît plus que lorsque le chargement échoue réellement — **non tenu** : `#setError` subsiste sur delete, reset, toggle, check-all, postpone et spread (`budget-details-store.ts:863, 976, 1096, 1216, 1262, 1278`), et `error` agrège toujours `#state.errorMessage()` (`:256`) dans le signal qui pilote la carte plein écran (`budget-details-page.html:9`)
- [x] Le refus s'affiche en toast et cite l'échéance — `budget-details-snackbar.utils.ts:210`, message issu du 422
- [x] Les tests échouent si une mutation en échec repose une valeur sur `error()` — `budget-details-store-integration.spec.ts:290, 370, 716, 745`

### Phase 3 — Le picker web cesse de proposer l'impossible

- [x] L'état hors horizon se calcule sans appel réseau supplémentaire — `savings-goal-picker-field.ts:152` mappe `goals()` déjà chargé
- [x] Le composant se comporte comme avant sans période — `input<BudgetPeriod | null>(null)` (`:127`), test `disables nothing when no budget period is supplied`
- [x] Un objectif hors horizon reste lisible et non sélectionnable — `[disabled]` sur l'option, jamais de filtrage (`:97`)
- [x] Le motif nomme l'échéance — `savingsGoals.pickerOutsideHorizon` (`fr.json:1041`), test `toContain('août 2027')`
- [x] Créer ou modifier sur un mois postérieur n'atteint plus le refus serveur — `create/dialog.ts:472`, `edit/dialog.ts:200`, les deux appelants du dialogue d'édition passent la période (`budget-items-container.ts:443`, `budget-table.ts:372`)
- [x] Le picker du Mois Type propose toujours tous les objectifs — `edit-template-line-dialog.ts` non modifié, aucune période liée
- [x] Les tests échouent si le calcul ignore le jour de paie — paire de tests payDay 1 vs 27 sur `2027-08-28`

### Phase 4 — Le picker iOS atteint la même parité

- [x] Le verdict se calcule depuis les objectifs déjà chargés — `SavingsGoalPickerField.swift:40` lit `store.goals`
- [x] Le composant se comporte comme avant sans période — `var budgetPeriod: BudgetPeriod?` (`:31`), test `withoutBudgetPeriod_neverOutsideHorizon`
- [x] Un objectif hors horizon reste lisible et ne peut pas être choisi — `.disabled(true)` sur l'entrée du menu (`:147`)
- [x] Le motif nomme l'échéance — `:144`
- [x] Ajouter ou modifier sur un mois postérieur n'atteint plus le refus serveur — `AddBudgetLineSheet.swift:131`, `EditBudgetLineSheet.swift:93` alimenté par `BudgetDetailsView+Routing.swift:56`
- [x] Le picker du Mois Type propose toujours tous les objectifs — `EditTemplateLineSheet.swift:96` inchangé
- [x] Les tests échouent si le verdict ignore le jour de paie — `verdictFollowsPayDay`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | functional | 2 | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts:256` | Le symptôme rapporté est une classe, pas un cas : seuls `createBudgetLine` et `updateBudgetLine` quittent `#setError`. Un delete, un toggle, un check-all, un reset, un postpone ou un spread en échec remplit toujours `#state.errorMessage()`, que `error` agrège, et la page entière bascule sur « Impossible de charger ton budget ». Six mutations gardent le bug corrigé pour deux. | Corriger au niveau du modèle plutôt qu'appelant par appelant : réserver `error` à l'échec de chargement de la ressource, faire remonter chaque mutation par sa valeur de retour comme ce diff l'inaugure, puis supprimer `#setError`. |
| 🟡 | code | 4 | `ios/Pulpe/Shared/Components/EditBudgetLineSheet.swift:33` | `budgetPeriod: BudgetPeriod? = nil` rend la borne d'horizon optionnelle : un futur présentateur qui oublie l'argument compile et retombe silencieusement sur le 422. Le jumeau web a fait l'inverse — `EditBudgetLineDialogData.budgetPeriod` est non optionnel, donc le compilateur impose la période. | Retirer la valeur par défaut. Les deux seuls sites (`BudgetDetailsView+Routing.swift:53` et le `#Preview` à `:246`) peuvent passer la période ou `nil` explicitement. |
| 🟡 | fit | 2 | `frontend/projects/webapp/public/i18n/fr.json:1419` | La nouvelle copy ne cite que deux issues (repousser l'échéance, autre objectif). Le lissage lève toujours ce même code, et pour un lissage l'issue applicable — le raccourcir — est précisément celle qui a été retirée. | Nommer les trois issues, ou brancher la copy selon que le refus vient d'une ligne unique ou d'un lissage. |
| 🟢 | fit | 3 | `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line/create/dialog.ts:472` | En mode lissage la période transmise est celle de l'ancre seule. Un lissage qui démarre dans l'horizon et finit au-delà est encore proposé et atteint encore le 422 — le garde serveur le rattrape, mais le picker ne prévient pas. | Borner sur la dernière période du lissage quand le mode est actif (`SpreadCalculator` la connaît déjà) ; le garde serveur reste le filet. |
| 🟢 | rot | 4 | `ios/Pulpe/Shared/Components/SavingsGoalPickerField.swift:144` | `Formatters.monthName` renvoie `.capitalized` : iOS affiche « Échéance dépassée · Août 2027 » là où le web affiche « août 2027 » via `formatDate(…, 'MMMM yyyy', fr)`. Même motif, deux orthographes, sur une phase dont l'objet est la parité. | Aligner la casse sur une des deux plateformes. |
| 🟢 | code | 2 | `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts:556` | `#lastBudgetLineWriteError` sert création et modification, et chaque point d'entrée le remet à `null`. Le commentaire justifie par le single-flight, vrai aujourd'hui ; une paire concurrente ferait effacer le message précis du premier par le reset du second (dégradation douce : repli sur la clé générique). | Un champ par mutation, ou renvoyer le message directement depuis `onError` si `cachedMutation` le permet. |
| 🟢 | code | 3, 4 | `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line/edit/dialog.ts:200` | Le verdict d'horizon est couvert par des tests unitaires sur les deux plateformes, mais rien ne vérifie que les quatre feuilles/dialogues transmettent bien la période — or c'est le câblage qui régresse en silence, pas la formule pure. | Une assertion par surface : le picker reçoit une période non nulle (`create/dialog.spec.ts` existe déjà pour l'accueillir côté web). |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 96% (23/24)                                                                                                                                                                                                                                                                                                                                                                      |
| Files checked | les 23 fichiers du diff `preview...HEAD` : `tag-links.util.ts`, `supabase-budget-line.repository.{ts,spec.ts}`, `fr.json`, `api-error-localizer.spec.ts`, `budget-details-{page,dialog.service}.ts`, `budget-line/{create,edit}/dialog.ts`, `budget-items-container.ts`, `budget-table.ts`, `budget-details-store{,-integration.spec}.ts`, `budget-details-snackbar.utils.ts`, `savings-goal-picker-field.{ts,spec.ts}`, `APIError.swift`, `AddBudgetLineSheet.swift`, `BudgetDetailsView+Routing.swift`, `EditBudgetLineSheet.swift`, `SavingsGoalPickerField.swift`, `AddBudgetLineSpreadSavingsGoalTests.swift`, `SavingsGoalPickerFieldTests.swift` |
| Unchecked     | Phase 2 — « La carte “Impossible de charger ton budget” n'apparaît plus que lorsque le chargement du budget échoue réellement » — fix                                                                                                                                                                                                                                             |
| Unplanned     | `budget-details-dialog.service.ts`, `budget-table.ts`, `budget-items-container.ts`, `budget-details-snackbar.utils.ts` (les projections des phases 2 et 3 ne nommaient que le store, la page et les deux dialogues) ; `BudgetDetailsView+Routing.swift` ; les tests de la phase 2 sont allés dans `budget-details-store-integration.spec.ts` et non `budget-details-store.spec.ts` ; ceux de la phase 4 ont été ajoutés à `SavingsGoalPickerFieldTests.swift` au lieu du fichier `SavingsGoalPickerHorizonTests.swift` projeté |
