# Review: Alléger l'écran iOS de détail d'objectif d'épargne

- **Verdict**: approve (les trois constats actionnables de cette passe ont été corrigés, suites rejouées)
- **Diff**: `preview...HEAD` + arbre de travail
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 3 warning (3 corrigés), 4 minor (0 corrigés, 4 acceptés)

## Phases

### Phase 1 — Hero plat : `GoalProgressHero` + `GoalHeroPresentation`, une projection unique

- [x] `displayedProjection` porte une projection unique ; `displayedProjectionFraction` nil pour une cible 0, borné à 1 — `ios/Pulpe/Domain/Models/SavingsGoalProgress.swift:134`. Formule amendée après le correctif de trajectoire : `projected ?? months.last?.projectedCumulative ?? plannedProjection`. Le repli intermédiaire est nouveau et a été arbitré par Maxime en cours de session ; `plan.md` décrit encore la forme à deux termes.
- [x] Fixture FULL : verdict, projection, `requiredPace`, `showsStatusChip`, cas sans mois clôturé, et cas sans cible ni échéance — `ios/PulpeTests/Features/SavingsGoals/GoalHeroPresentationTests.swift:131`
- [x] Hero sans fond ni bordure, aucun `Image(systemName:)`, `savingsGoalProgressCard` toujours résolu — `ios/Pulpe/Features/SavingsGoals/Components/GoalProgressHero.swift:23`
- [x] Chip absent sur actif, présent sur en pause et atteint — `ios/PulpeTests/Features/SavingsGoals/GoalHeroPresentationTests.swift:187`
- [x] `pnpm test:lexicon` vert ; anciennes clés absentes des sources Swift
- [x] `testFourDetailStatesRenderOnlyApplicableRegions` vert — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift`

### Phase 2 — Grammaire des sections : `SectionHeader` promu dans `Shared/`

- [x] `HomeSectionHeader` n'existe plus ; les cartes home compilent — `ios/Pulpe/Shared/Components/SectionHeader.swift`
- [x] `SectionHeader(title:link:linkAccessibilityIdentifier:)` expose le `Button` et garde le label a11y — `ios/Pulpe/Shared/Components/SectionHeader.swift`
- [x] `savingsGoalTrajectoryTitle` hors de la carte du chart ; `savingsGoalAdjustPlanButton` sans icône — `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:176`
- [x] Aucun `PulpeTypography.title2`, aucun `Image(systemName:)` dans un titre de section — grep vide sur `Features/SavingsGoals`
- [x] Suite `SavingsGoalIntervalUITests` verte (9/9)

### Phase 3 — Trajectoire : chart sur tokens, encre unique, tick d'échéance visible

- [x] Aucune hauteur ni dash brut dans `Features/SavingsGoals` ; même hauteur détail/simulateur
- [x] Aucune occurrence de `financialIncome` dans `GoalProjectionChart.swift`
- [x] Tick d'échéance ancré `.topTrailing` ; test `ticks` sur 2, 3 et 24 mois — `ios/PulpeTests/Features/SavingsGoals/GoalProjectionSeriesTests.swift:23`
- [x] Écart positif / négatif / nul lus par `gapCopy` — `ios/PulpeTests/Features/SavingsGoals/GoalProjectionSeriesTests.swift:74`
- [x] `GoalProjectionSeriesTests` vert (12 `@Test`, dont une paramétrée sur 3 durées) dans la suite complète `PulpeTests` 2161/2161 ; `pnpm test:lexicon` vert

### Phase 4 — Historiques en ledger : « Ton suivi » et « Retraits » en une carte par groupe

- [x] `GoalContributionsSection.swift` : un seul `pulpeRowCard()`, aucun `pulpeCard()`, montant en `amountMedium`
- [x] `GoalWithdrawalsSection` : `chevron.right` seule icône ; rangées avec `budgetId` restées des `Button` avec label et hint — `ios/Pulpe/Features/SavingsGoals/GoalWithdrawalsSection+Rows.swift:105`
- [ ] Aucun fichier de `Features/SavingsGoals` ne dépasse 500 lignes — 4 fichiers dépassent (`SavingsGoalDetailView` 719, `GoalPlanSimulatorSheet` 609, `GoalPlanApplyRecapSheet` 609, `SavingsGoalFormSheet` 538), tous antérieurs à la branche et portant déjà `// swiftlint:disable file_length`
- [x] Suite `SavingsGoalIntervalUITests` verte (9/9 sur un run à vide) ; chaque groupe d'historique dans une seule carte

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | code | 1 | `ios/Pulpe/Domain/Models/SavingsGoalProgress.swift:134` | Après le correctif de trajectoire, la courbe finissait sur le solde net alors que le hero, la barre et le verdict citaient `plannedProjection`, qui ne retranche aucun retrait par construction. Un objectif sans cible ni échéance (chemin produit documenté, `projected` nil) annonçait 3 600 pendant que la courbe finissait à 2 900. | Insérer `months.last?.projectedCumulative` dans la chaîne de repli, des deux côtés. Corrigé ; test discriminant `projection_quotesTheNetBalanceWhenTheServerHasNoProjection` (iOS) et `'falls back on the net balance, not the gross plan'` (webapp). |
| 🟡 | code | - | `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:315` | L'aperçu « Projection après création » restait basé sur `plannedProjection` : troisième surface citant un chiffre brut à côté d'une courbe nette. Même défaut sur `savings-goal-detail-page.ts:1308`. | Baser l'aperçu sur `displayedProjection`. Corrigé sur les deux plateformes. |
| 🟡 | conform | - | `frontend/.../detail/components/goal-projection-chart.config.ts:161` | Commentaires français introduits par ce diff dans deux fichiers webapp intégralement anglais sur `preview` (`goal-projection-chart.config.ts`, `.spec.ts`). `CLAUDE.md` racine : « Code and docs are English ». L'arbre Swift est bilingue sur `preview`, donc aucun constat côté iOS. | Traduire chaque commentaire français des deux fichiers. Corrigé. |
| 🟢 | code | 3 | `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:18` | `yMin` vaut `0` en dur : un solde négatif s'aplatit contre l'axe au lieu de creuser. Le serveur ne clampe jamais à 0 (`docs/SAVINGS.md:157`), et le découvert reste bloqué à l'écriture — le cas est donc rare mais atteignable via une incohérence de données. | Pré-existant, hors périmètre du plan. Faire dépendre `yMin` du minimum de la série quand il est négatif. Non corrigé. |
| 🟢 | rot | 3 | `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:301` | La somme courante `cumulative` ne sert plus que de repli pour un payload sans `projectedCumulative`, mais reste calculée à chaque mois du chemin nominal. | Acceptable tant que le repli est nécessaire ; à retirer quand plus aucun client ne peut recevoir un payload sans le champ. |
| 🟢 | rot | 1 | `aidd_docs/tasks/2026_08/2026_08_16_ios-savings-goal-detail-redesign/plan.md:29` | La ligne de décision décrit `displayedProjection = projected ?? plannedProjection`, forme superseded par le correctif de trajectoire. | Laissé tel quel : `plan.md` est le relevé daté de ce qui a été décidé avant l'implémentation, pas une spec vivante. Le comportement courant est porté par le doc-comment de `SavingsGoalProgress.swift:124` et ses tests. |
| 🟢 | fit | - | `frontend/.../detail/savings-goal-detail-page.ts:881` | Correctif webapp hors du périmètre iOS du plan. | Extension délibérée : le défaut était identique des deux côtés, et le laisser aurait fait dessiner deux courbes différentes pour un même objectif. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 95% (19/20)                                        |
| Files checked | `SavingsGoalProgress.swift`, `GoalProgressHero.swift`, `GoalHeroPresentation.swift`, `GoalProjectionChart.swift`, `SavingsGoalDetailView.swift`, `SectionHeader.swift`, `GoalPlanTimelineSection.swift`, `GoalContributionsSection.swift`, `GoalWithdrawalsSection+Rows.swift`, `GoalPlanSimulatorSheet.swift`, `GoalHeroPresentationTests.swift`, `GoalProjectionSeriesTests.swift`, `Localizable.xcstrings`, `savings-goal-detail-page.ts`, `savings-goal-detail-page.spec.ts`, `goal-projection-chart.config.ts`, `goal-projection-chart.config.spec.ts`, `fr/en/de/it.json` |
| Unchecked     | Aucun fichier > 500 lignes — not-applicable (les 4 dépassements précèdent la branche et portent leur `swiftlint:disable` ; les fichiers réécrits par la phase 4 sont tous sous 500) |
| Unplanned     | Correctif de la trajectoire face aux retraits annoncés (iOS + webapp, hors plan) ; alignement du hero et de l'aperçu de réparation sur le solde net ; harmonisation typographique du bas d'écran ; refonte UX de la feuille « Ajuster mon plan » — issus des retours écran de Maxime pendant la session, pas du plan |
