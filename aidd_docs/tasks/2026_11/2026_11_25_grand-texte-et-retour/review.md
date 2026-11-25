# Review: Grand texte iOS et Retour sur menu Android

## Round 1

- Diff: `origin/main...786277a81`
- Uncommitted changes: no
- Axes: code, functional, relevancy
- Verdict: approve, because every criterion traces to the code or to captures taken on this head, and no finding is above minor

### Criteria

- [x] Back with the menu open closes it and the router listener is not called; a second Back reaches the router — `android/src/core/ui/menu.tsx:13-23`, asserted by `android/src/core/ui/menu.spec.tsx:81-99`
- [x] At AX5 no chip row is wider than the sheet and no text is cut on the left — `TransactionDateSelector.swift` stacks the compact picker, `ChipFlowLayout.swift` measures an over-wide chip at the row width; captures `apres/ios-ax5-*-nouvelle-depense-*`, `-nouvelle-prevision*`, `-nouvelle-ligne*`
- [x] At AX5 every segment label reads in full; at the default size the picker is the same capsule as before — `SegmentedPicker.swift` (`isStacked` only under `isAccessibilitySize`); captures `apres/ios-normal-*-nouvelle-prevision-quand`
- [x] At AX5 the type value wraps on whole words under « Type » — `AssetFormSheet.swift` type row; capture `apres/ios-ax5-*-ajout-patrimoine-type`
- [x] At AX5 no breakdown label is truncated or clipped by the card; at the default size the diagram is unchanged — `NetWorthBreakdownCard.swift` legend under `labelsInLegend`; captures `apres/ios-ax5-*-repartition`, `apres/ios-normal-*-repartition`

### Assumptions

- Paper's Menu registers its own Back listener only after its async `show()`, so it runs before ours and calls `onDismiss` too — holds and harmless: every caller passes an idempotent setter, checked at `budget-detail-overlays.tsx:286`, `delete-month-action.tsx:106`, `plan.tsx:295,322`, `asset-group-card.tsx:76,254`, `goal/[id].tsx:268`, `template/[id].tsx:228`, `line/[lineId].tsx:172`
- `AccountPickerField` keeps its own accessibility-size row and calls `savingsGoalMenuLabel` only at normal sizes — holds, checked at `AccountPickerField.swift:121-127`
- `ChipFlowLayout` also lays out the onboarding suggestions; chips that fit keep their ideal size — holds, `ChipFlowLayout.swift:31-33` re-measures only when `ideal.width > width`

### Findings

- `ios/Pulpe/Features/NetWorth/Breakdown/NetWorthBreakdownCard.swift:126` : at accessibility sizes the legend rows are VoiceOver elements of their own, next to the diagram's single sentence, so VoiceOver reads each amount twice, proof `NetWorthBreakdownCard.swift:44` (`.accessibilityElement(children: .ignore)` plus its label) → hide the legend from VoiceOver (`.accessibilityHidden(true)` on the legend stack) — 🟢 minor
- `android/src/core/ui/menu.tsx:23` : callers pass an inline `onDismiss`, so the Back listener is removed and re-added on every render while the menu is open, proof `delete-month-action.tsx:106` → harmless today; a ref to the latest `onDismiss` would keep one subscription — 🟢 minor

### Limits

- The Android fix is not shown on a device: under a machine load near 700 the emulator's input and System UI stopped responding — an emulator capture with the menu open, then after Back, would settle it
- No automated test covers the iOS layouts: they are verified by the before/after simulator captures only

## Round 2

- Diff: `786277a81` plus uncommitted `NetWorthBreakdownCard.swift`
- Uncommitted changes: yes
- Axes: code
- Verdict: approve, because the legend is now hidden from VoiceOver as a whole, so each amount is read once, by the diagram's sentence

### Findings

- `android/src/core/ui/menu.tsx:23` : the re-subscription on each render stays, harmless as round 1 says — 🟢 minor

## Round 3

- Diff: `786277a81` plus uncommitted `NetWorthBreakdownCard.swift`
- Uncommitted changes: yes
- Axes: functional
- Verdict: approve, because the Android limit of round 1 is now settled on a device

### Criteria

- [x] Back with the menu open closes it and the router listener is not called; a second Back reaches the router — emulator run on this head: « Budget Étudiant » ⋮ open (`apres/android-menu-ouvert.png`), Back closes it and the screen stays (`apres/android-apres-retour.png`), a second Back returns to the Modèles list
