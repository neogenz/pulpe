# Review: Détail d’objectif iOS

- **Verdict**: approve
- **Diff**: `058d6ac5025bbe39aff9c709507c87729079f3d7...1967205fe7fce8ff49325ab8b1b81a618b68990e`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_21
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Verrouiller puis corriger la présentation mensuelle iOS

- [x] Le scénario matérialisé sans Prévision liée expose l’ancien faux « Pas de budget » — `ios/PulpeTests/Features/SavingsGoals/GoalPlanTimelinePresentationTests.swift:6`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanMonthRow.swift:48`
- [x] Le test distingue absence de Prévision, budget absent et liste repliée/développée — `ios/PulpeTests/Features/SavingsGoals/GoalPlanTimelinePresentationTests.swift:6`, `ios/PulpeTests/Features/SavingsGoals/GoalPlanTimelinePresentationTests.swift:18`
- [x] Les mois matérialisés sans ligne liée affichent « Aucune prévision liée » — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:8`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanMonthRow.swift:48`
- [x] Un mois provisionnable conserve « Pas de budget » — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:11`
- [x] Le récapitulatif compte les mois sans Prévision liée — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:69`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:135`
- [x] VoiceOver, montants, cumuls et états pointés suivent le contenu — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanMonthRow.swift:24`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanMonthRow.swift:80`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanMonthRow.swift:100`
- [x] Les mois vides utilisent une information secondaire sans capsule — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanMonthRow.swift:48`
- [x] La timeline courte possède un contrôle pleine largeur et l’état développé restitue tout l’horizon — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:51`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:115`
- [x] Le contrôle replie la liste, expose 44 pt et adapte son hint VoiceOver — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:117`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:124`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:132`
- [x] Le titre et l’ajustement partagent la même rangée avec les primitives existantes — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:95`
- [x] Le test ciblé et le build `PulpeLocal` disposent des fixtures nécessaires — `ios/PulpeTests/Features/SavingsGoals/GoalPlanTimelinePresentationTests.swift:4`

### Phase 2 — Distiller la hiérarchie du détail d’objectif

- [x] Le détail utilise une navigation inline et un niveau commun pour les trois sections — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:54`, `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:96`, `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:160`, `ios/Pulpe/Features/SavingsGoals/GoalContributionsSection.swift:15`
- [x] Aucun token, composant partagé, matériau ou accent décoratif n’est ajouté — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:187`
- [x] Le résumé ne répète plus le montant épargné et conserve cible, barre, rythme, prévu et effort requis — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:187`
- [x] Le montant de départ reste conditionnel et chaque montant garde `.sensitiveAmount()` — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:190`, `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:212`, `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:262`
- [x] La trajectoire proche retire le repère d’ancrage tandis que l’horizon espacé garde trois repères — `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:300`, `ios/PulpeTests/Features/SavingsGoals/GoalProjectionSeriesTests.swift:5`
- [x] Les séries, cible, écart et atteinte estimée sont conservés — `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:164`, `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:246`
- [x] Chaque contribution reste une carte et les transactions perdent leur fond imbriqué — `ios/Pulpe/Features/SavingsGoals/GoalContributionsSection.swift:40`, `ios/Pulpe/Features/SavingsGoals/GoalContributionsSection.swift:67`
- [x] Typographies dynamiques, couleurs adaptatives, confidentialité et cible d’expansion sont conservées — `ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelineSection.swift:124`, `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:190`, `ios/Pulpe/Features/SavingsGoals/GoalContributionsSection.swift:60`
- [x] Les deux suites ciblées couvrent la régression et le happy path — `ios/PulpeTests/Features/SavingsGoals/GoalPlanTimelinePresentationTests.swift:4`, `ios/PulpeTests/Features/SavingsGoals/GoalProjectionSeriesTests.swift:4`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (20/20) |
| Files checked | `plan.md`, `phase-1.md`, `phase-2.md`, `GoalPlanMonthRow.swift`, `GoalPlanTimelineSection.swift`, `GoalProjectionChart.swift`, `GoalContributionsSection.swift`, `SavingsGoalDetailView.swift`, `GoalPlanTimelinePresentationTests.swift`, `GoalProjectionSeriesTests.swift`, `ios/DESIGN.md`, `Typography.swift` |
| Unchecked     | none |
| Unplanned     | none |
