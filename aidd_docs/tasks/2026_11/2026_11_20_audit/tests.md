# Codebase Audit: tests (PR #915, cbe305587..213322c41)

Behaviour is well covered; one regression lock was lost.

- **Date**: 2026_11_20
- **Scope**: diff of branch claude/android-home-hero-ios-parity-e3c75b against main, read with callers and neighbours
- **Health**: fair
- **Findings**: 0 critical, 1 major, 2 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | tests | `android/src/core/ui/sheet.spec.tsx:113` (deleted in 38632f34d) | The repo-wide guard "never measures the window without also asking for the keyboard" was deleted, not adapted. `segmented-picker.tsx:41` and `budget-line-row.tsx:53` read only `useWindowDimensions().fontScale` and would have failed it. Main still has the guard. A future sheet sized on window height that ignores the keyboard passes CI again. | Restore the guard and exempt `.fontScale` reads (`useWindowDimensions\(\)(?!\.fontScale)`). | S |
| 🟢 | tests | `android/src/features/current-month/balance-chart-scale.spec.ts:89` | The domain test rebuilds the expected value with `chartSpan(quiet)` and `0.12`, so a wrong span stays green; `chartSpan` is exported (`balance-chart-scale.ts:77`) only for this test. | Assert literal numbers (2381.25 / 2536.25) and make `chartSpan` private. | S |
| 🟢 | tests | `android/maestro/add-operation.yaml:28` | `tapOn: "Montant, en .*"` relies on the content-desc built by `common.amountInCurrency`; never run on a device in this branch. | One Maestro run, or a `testID` on `AmountField`. | S |

## Top actions

1. Restore the window/keyboard guard with a `.fontScale` exemption.
2. Make the chart-domain test assert literal numbers; un-export `chartSpan`.
3. Run `add-operation.yaml` on the emulator once.

## Coverage

- **Scanned**: tests (every spec diff; Jest 208 suites / 1379 tests green at 213322c41; iOS PulpeTests green after the iOS commits)
- **Skipped**: coverage percentage (no coverage tool wired for android/)
