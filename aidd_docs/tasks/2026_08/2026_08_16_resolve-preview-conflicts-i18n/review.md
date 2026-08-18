# Review: Resolve `preview` conflicts on the i18n branch

- **Verdict**: approve
- **Diff**: `0f19dc12b...b49bddbd5`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Integrate preview and reconcile iOS picker changes

- [x] The merge records `origin/preview` at `3f8181e3d` as an ancestor without rewriting the published feature history — `4e0aa952c`
- [x] Both conflicts retain `SegmentedPicker`, explicit Pulpe locale titles and per-segment accessibility; `CapsulePicker` is deleted — `ios/Pulpe/Features/SavingsGoals/SavingsGoalFormSheet.swift:186`, `ios/Pulpe/Shared/Components/CurrencyAmountPicker.swift:13`
- [x] The preview deck remains covered and the reconciled visible strings have FR/EN/DE/IT catalog entries with no conflict marker — `ios/PulpeTests/Features/CurrentMonth/UncheckedOperationsCardDeckTests.swift:7`, `ios/Pulpe/Resources/Localizable.xcstrings:10142`

### Phase 2 — Prove merge readiness and publish the resolution

- [x] Static assertions, strict SwiftLint and the code-signing-disabled iOS build pass — `ios/Pulpe/Shared/Components/SegmentedPicker.swift:8`, `ios/Pulpe/Shared/Components/CurrencyAmountPicker.swift:18`
- [x] The full iOS suite passes with 2,138 passed, 0 failed and 9 intentional skips out of 2,147 tests; locale tests, deck tests and `pnpm quality` pass — `ios/PulpeTests/Features/CurrentMonth/UncheckedOperationsCardDeckTests.swift:10`
- [x] The remote contains the verified preview tip and GitHub PR #605 reports `MERGEABLE / CLEAN` with every required check green — `b49bddbd5`

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (6/6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Files checked | `ios/Pulpe/Features/SavingsGoals/SavingsGoalFormSheet.swift`, `ios/Pulpe/Shared/Components/CurrencyAmountPicker.swift`, `ios/Pulpe/Shared/Components/SegmentedPicker.swift`, `ios/Pulpe/Features/CurrentMonth/Components/UncheckedOperationsCard.swift`, `ios/PulpeTests/Features/CurrentMonth/UncheckedOperationsCardDeckTests.swift`, `ios/Pulpe/Resources/Localizable.xcstrings`, `aidd_docs/memory/mobile.md`, `aidd_docs/tasks/2026_08/2026_08_16_resolve-preview-conflicts-i18n/plan.md`, `phase-1.md`, `phase-2.md` |
| Unchecked     | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Unplanned     | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
