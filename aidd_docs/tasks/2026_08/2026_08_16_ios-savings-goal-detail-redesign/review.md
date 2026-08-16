# Review: Alléger l'écran iOS de détail d'objectif d'épargne

- **Verdict**: approve (les deux constats actionnables ont été corrigés et les suites rejouées)
- **Diff**: `preview...HEAD` + arbre de travail
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 1 warning (corrigé), 4 minor (2 corrigés, 2 acceptés)

## Phases

### Phase 1 — Hero plat : `GoalProgressHero` + `GoalHeroPresentation`, une projection unique

- [x] `displayedProjection` vaut `projected` quand présent, `plannedProjection` sinon ; `displayedProjectionFraction` nil pour une cible 0, borné à 1 — `ios/Pulpe/Domain/Models/SavingsGoalProgress.swift:126`
- [x] Fixture FULL : verdict, projection, `requiredPace`, `showsStatusChip`, et le cas sans mois clôturé — `ios/PulpeTests/Features/SavingsGoals/GoalHeroPresentationTests.swift:86`
- [x] Hero sans fond ni bordure, aucun `Image(systemName:)`, `savingsGoalProgressCard` toujours résolu — `ios/Pulpe/Features/SavingsGoals/Components/GoalProgressHero.swift:23`
- [x] Chip absent sur actif, présent sur en pause et atteint — `ios/PulpeTests/Features/SavingsGoals/GoalHeroPresentationTests.swift:168`
- [x] `pnpm test:lexicon` vert (8/8) ; anciennes clés absentes des sources Swift
- [x] `testFourDetailStatesRenderOnlyApplicableRegions` vert — `ios/PulpeUITests/SavingsGoalIntervalUITests.swift`

### Phase 2 — Grammaire des sections : `SectionHeader` promu dans `Shared/`

- [x] `HomeSectionHeader` n'existe plus ; les cartes home compilent — `ios/Pulpe/Shared/Components/SectionHeader.swift`
- [x] `SectionHeader(title:link:linkAccessibilityIdentifier:)` expose le `Button` et garde le label a11y — `ios/Pulpe/Shared/Components/SectionHeader.swift`
- [x] `savingsGoalTrajectoryTitle` hors de la carte du chart ; `savingsGoalAdjustPlanButton` sans icône — `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:176`
- [x] Aucun `PulpeTypography.title2`, aucun `Image(systemName:)` dans un titre de section — grep vide sur `Features/SavingsGoals`
- [x] Suite `SavingsGoalIntervalUITests` verte (9/9)

### Phase 3 — Trajectoire : chart sur tokens, encre unique, tick d'échéance visible

- [x] Aucune hauteur ni dash brut dans `Features/SavingsGoals` ; même hauteur détail/simulateur — grep `height: (200|160)|dash: \[` vide
- [x] Aucune occurrence de `financialIncome` dans `GoalProjectionChart.swift`
- [x] Tick d'échéance ancré `.topTrailing` ; test `ticks` sur 2, 3 et 24 mois — `ios/PulpeTests/Features/SavingsGoals/GoalProjectionSeriesTests.swift:23`
- [x] Écart positif / négatif / nul lus par `gapCopy` — `ios/PulpeTests/Features/SavingsGoals/GoalProjectionSeriesTests.swift:74`
- [x] `GoalProjectionSeriesTests` vert avec 11 tests exécutés ; `pnpm test:lexicon` vert

### Phase 4 — Historiques en ledger : « Ton suivi » et « Retraits » en une carte par groupe

- [x] `GoalContributionsSection.swift` : un seul `pulpeRowCard()`, aucun `pulpeCard()`, montant en `amountMedium`
- [x] `GoalWithdrawalsSection` : `chevron.right` seule icône ; rangées avec `budgetId` restées des `Button` avec label et hint — `ios/Pulpe/Features/SavingsGoals/GoalWithdrawalsSection+Rows.swift:105`
- [ ] Aucun fichier de `Features/SavingsGoals` ne dépasse 500 lignes — 4 fichiers dépassent (`SavingsGoalDetailView` 719, `GoalPlanSimulatorSheet` 609, `GoalPlanApplyRecapSheet` 609, `SavingsGoalFormSheet` 538), tous antérieurs à la branche et portant déjà `// swiftlint:disable file_length`
- [x] Suite `SavingsGoalIntervalUITests` verte (9/9 sur un run à vide) ; chaque groupe d'historique dans une seule carte. Le trio `testDeadlineReconciliation*` est flaky sous charge : il a échoué deux fois pendant que d'autres tâches tournaient, et repasse isolé comme en suite complète à vide. Le flux d'échéance n'est touché par aucun fichier du diff.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | conform | - | `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:145` | `.easeInOut(duration: DesignTokens.Animation.quickSnap)` réécrit à la main le token `DesignTokens.Animation.quickEaseInOut`, que le même diff utilise pourtant dans `GoalPlanSimEditRow.swift:88`. `no-magic-design-values.md` demande le token. | Remplacer par `DesignTokens.Animation.quickEaseInOut`. Appliqué. |
| 🟢 | rot | - | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:455` | Le doc-comment de `revert()` cite « Repartir du plan actuel », libellé retiré au profit de « Réinitialiser ». | Renommer le libellé cité. Appliqué. |
| 🟢 | rot | 3 | `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:301` | La somme courante `cumulative` ne sert plus que de repli pour un payload sans `projectedCumulative`, mais reste calculée à chaque mois du chemin nominal. | Acceptable tant que le repli est nécessaire ; à retirer quand plus aucun client ne peut recevoir un payload sans le champ. |
| 🟢 | rot | - | `ios/PulpeTests/Features/SavingsGoals/GoalPlanSimulatorTests.swift:236` | Les assertions lisent le texte source Swift (`resetButtonSource.contains(".padding(…)")`) : un reformatage casse le test sans changement de comportement. Motif pré-existant, étendu par ce diff. | Laisser tel quel ; ces tests gardent une règle de layout qu'aucun autre outil ne vérifie. |
| 🟢 | fit | - | `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:139` | Correctif webapp hors du périmètre iOS du plan. | Extension délibérée : le défaut de trajectoire était identique des deux côtés, et le laisser aurait fait dessiner deux courbes différentes pour un même objectif. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 95% (19/20)                                        |
| Files checked | `GoalProgressHero.swift`, `GoalHeroPresentation.swift`, `SavingsGoalProgress.swift`, `SectionHeader.swift`, `GoalProjectionChart.swift`, `GoalPlanTimelineSection.swift`, `GoalPlanMonthRow.swift`, `GoalContributionsSection.swift`, `GoalWithdrawalsSection.swift`, `GoalWithdrawalsSection+Rows.swift`, `GoalPlanSimEditRow.swift`, `GoalPlanSimulatorSheet.swift`, `GoalPlanSimulatorTimeline.swift`, `Localizable.xcstrings`, `goal-projection-chart.config.ts` |
| Unchecked     | Aucun fichier > 500 lignes — not-applicable (les 4 dépassements précèdent la branche et portent leur `swiftlint:disable` ; les fichiers réécrits par la phase 4 sont tous sous 500, et `SavingsGoalDetailView` a même perdu 27 lignes) |
| Unplanned     | Correctif de la trajectoire face aux retraits annoncés (iOS + webapp, hors plan) ; harmonisation typographique du bas d'écran ; refonte UX de la feuille « Ajuster mon plan » — les trois issus des retours écran de Maxime pendant la session, pas du plan |
