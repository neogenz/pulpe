# Review: Native home activity swipe

- **Verdict**: changes-requested
- **Diff**: `origin/preview...d5e5f65d7`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_26
- **Findings**: 0 critical, 3 warning, 2 minor

## Phases

### Phase 1 — Budget ledger pan arbitration

- [x] A vertically dominant pan is declined before the horizontal recognizer begins — `ios/Pulpe/Shared/Components/HorizontalPanGesture.swift:65`
- [x] A disabled recognizer remains inert — `ios/Pulpe/Shared/Components/HorizontalPanGesture.swift:35`
- [x] Both budget-ledger row families use the axis-selective recognizer — `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsFreeTransactionsList.swift:185`, `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineMixedRow.swift:151`
- [x] Pulls past the commit distance toggle once; shorter pulls settle without committing — `ios/Pulpe/Shared/Components/LeadingSwipeAction.swift:55`
- [x] Live tracking is unanimated and the spring runs only while settling — `ios/Pulpe/Shared/Components/LeadingSwipeAction.swift:55`, `ios/Pulpe/Shared/Components/LeadingSwipeAction.swift:70`
- [x] Cancelled and failed gestures settle the row — `ios/Pulpe/Shared/Components/HorizontalPanGesture.swift:53`, `ios/Pulpe/Shared/Components/LeadingSwipeAction.swift:49`
- [x] Existing row buttons and the independent point control remain in place — `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsFreeTransactionsList.swift:184`, `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineMixedRow.swift:149`
- [ ] A pull from the screen edge preserves interactive back navigation — runtime-only criterion, not-applicable to the static diff review
- [ ] Local build and SwiftLint succeed — runtime-only criterion, not-applicable to the static diff review

### Phase 2 — Legacy trailing-swipe physics

- [ ] The custom deceleration rate stays outside `TrailingSwipeActions` — superseded by deletion of the custom trailing implementation, not-applicable
- [ ] Zero-velocity and projected-velocity resting-offset cases pass — superseded by native swipe actions, not-applicable
- [ ] A fast vertical flick from a custom activity row scrolls immediately — superseded by native list rows, not-applicable
- [ ] An unmeasured custom action width does not swallow the first swipe — superseded by native swipe actions, not-applicable
- [ ] An interrupted custom gesture settles fully open or closed — superseded by native swipe actions, not-applicable
- [ ] The custom row tracks the finger without lag — superseded by native swipe actions, not-applicable
- [ ] The custom row rubber-bands past its actions — superseded by native swipe actions, not-applicable
- [ ] Custom Edit, Delete, and mutual exclusion behavior remain intact — superseded by native swipe actions, not-applicable
- [ ] Custom VoiceOver actions remain available — superseded by native swipe actions, not-applicable
- [ ] `TrailingSwipeActionsTests` and its focused verification pass — superseded by deletion of the implementation and tests, not-applicable

### Phase 3 — Native-list home shell

- [x] Existing `heroZone` and `contentZone` callers remain available while list content gains a separate row treatment — `ios/Pulpe/Shared/Components/HeroZone/HeroZoneSurface.swift:16`, `ios/Pulpe/Shared/Components/HeroZone/HeroZoneSurface.swift:25`
- [x] The hero paints the overscroll region and later rows paint the neutral content surface — `ios/Pulpe/Shared/Components/HeroZone/HeroZoneSurface.swift:41`, `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:327`
- [x] Parallax remains scroll-driven with Reduce Motion and no per-frame state — `ios/Pulpe/Shared/Components/HeroZone/HeroZoneSurface.swift:33`, `ios/Pulpe/Shared/Components/HeroZone/HeroZoneSurface.swift:54`
- [x] Loaded home uses one `List` with direct activity sections and no fixed nested-list height — `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:221`, `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:135`
- [x] Hero, content cap, dashboard rails, refresh, and unchecked scroll target remain wired — `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:223`, `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:282`, `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:336`
- [x] The UI harness starts a vertical scroll directly from an activity row — `ios/PulpeUITests/ContextualCreationUITests.swift:28`
- [x] Dynamic Type uses intrinsic rows without a fixed activity height — `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:135`, `ios/PulpeUITests/ContextualCreationUITests.swift:16`
- [ ] Normal, scrolled, overscrolled, skeleton, and fresh-signup screenshot approval — ignored runtime evidence is not-applicable to the static diff review

### Phase 4 — Native activity row actions

- [x] Each visible operation is a direct list row with stable transaction identity — `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:135`
- [x] Day headers, grouped row backgrounds, dividers, tags, and amounts remain represented — `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:140`, `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:169`, `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:225`
- [x] Trailing actions are native and full-swipe execution is disabled — `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:154`
- [x] Delete records a pending item and store mutation occurs only from the alert confirmation — `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:314`, `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:322`
- [x] Edit routes through the existing editor and action labels remain accessible — `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:161`, `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:357`
- [x] The custom trailing modifier and tests are deleted while the leading swipe remains — `ios/Pulpe/Shared/Components/LeadingSwipeAction.swift:44`
- [x] Native list gesture arbitration owns vertical flicks and dismissal of revealed actions — `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:154`
- [x] Mutual exclusion no longer depends on app-owned `openRowId` state — `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:12`
- [ ] Focused tests, SwiftLint, and the light/dark/accessibility action matrix succeed — the structural unit test references removed APIs and action UI tests launch only at `large`; fix

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | code | 3 | `ios/PulpeTests/Features/CurrentMonth/HomeHeroCardTests.swift:253` | `loadedDashboardUsesListCompatibleHeroSurface` requires `.heroListRow(parallax: true)` and `HeroListRowModifier`, but neither symbol exists in the final implementation, so the focused suite cannot pass. | Assert the shipped `.heroZone(parallax: true)` plus `ContentListRowModifier` contract, or restore the implementation named by the test. |
| 🟡 warning | functional | 4 | `ios/PulpeTests/Features/CurrentMonth/HomeHeroCardTests.swift:253` | The final verification criterion is unmet: one focused test is statically guaranteed to fail, and `HomeActivitySwipeUITests` covers only `large`, not dark or accessibility-size action presentation. | Repair the structural assertion and run the action tests across light, dark, and accessibility-size configurations before marking the phase done. |
| 🟡 warning | fit | 4 | `ios/Pulpe/Features/CurrentMonth/Components/ActivityCard.swift:184` | The native-action plan says SwiftUI owns chrome, but `swipeActionBackdrop` redraws it with assumed 60 pt slots and 10 pt gutters; this will not automatically track future system geometry or presentation changes. | Remove the visual mirror and solve the row-background cause so native chrome renders, or revise the plan and cover an adaptive fallback with pressed-state, locale, and Dynamic Type checks. |
| 🟢 minor | fit | 3 | `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:308` | The activity block lost its previous staggered entrance while the other dashboard blocks retain theirs; the visual behavior change is not in either plan. | Restore a list-compatible entrance for the activity header and rows, or record the removal as an intentional design decision. |
| 🟢 minor | fit | - | `ios/Pulpe/Resources/Localizable.xcstrings:6277` | The `%@` to `%lld` card-count translation correction is unrelated to swipe behavior. | Move the localization correction to a separate atomic change or explain why this feature requires it. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 96% (22/23 applicable; 13 not-applicable) |
| Files checked | `ActivityCard.swift`, `CurrentMonthView.swift`, `HeroZoneSurface.swift`, `HorizontalPanGesture.swift`, `LeadingSwipeAction.swift`, deleted `TrailingSwipeActions.swift`, `HomeHeroCardTests.swift`, deleted `TrailingSwipeActionsTests.swift`, `ContextualCreationUITests.swift`, `Localizable.xcstrings`, both feature plans |
| Unchecked | Phase 1 screen-edge navigation — not-applicable; Phase 1 build/lint — not-applicable; 10 legacy trailing-swipe criteria — not-applicable; Phase 3 screenshot matrix — not-applicable; Phase 4 focused verification — fix |
| Unplanned | custom swipe-action visual mirror; activity entrance animation removal; card-count localization placeholder correction |
