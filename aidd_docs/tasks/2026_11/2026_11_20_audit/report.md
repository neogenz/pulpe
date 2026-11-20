# Codebase Audit: all seven pillars (PR #915, cbe305587..213322c41)

Branch is sound; two major (a deleted regression guard, a half-cent scrub rounding gap with iOS) and eleven minor items, none blocking correctness.

- **Date**: 2026_11_20
- **Scope**: diff of branch claude/android-home-hero-ios-parity-e3c75b against main, read with callers and neighbours
- **Health**: fair
- **Findings**: 0 critical, 2 major, 11 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | code-quality | `android/src/features/current-month/balance-scrub.ts:97` | Scrub interpolation rounds in float: halfway between 2 and −1.99 gives `0.004999…` → 0.00, iOS `Decimal.rounded(2)` gives 0.01. Introduced; reproduced in node. Found by Codex. | Interpolate in integer cents, then round half away from zero; add the 2 / −1.99 case to the spec. | S |
| 🟡 | tests | `android/src/core/ui/sheet.spec.tsx:113` (deleted in 38632f34d) | The repo-wide guard "never measures the window without also asking for the keyboard" was deleted, not adapted. `segmented-picker.tsx:41` and `budget-line-row.tsx:53` read only `useWindowDimensions().fontScale` and would have failed it. Main still has the guard. A future sheet sized on window height that ignores the keyboard passes CI again. | Restore the guard and exempt `.fontScale` reads (`useWindowDimensions\(\)(?!\.fontScale)`). | S |
| 🟢 | tests | `android/src/features/current-month/balance-chart-scale.spec.ts:89` | The domain test rebuilds the expected value with `chartSpan(quiet)` and `0.12`, so a wrong span stays green; `chartSpan` is exported (`balance-chart-scale.ts:77`) only for this test. | Assert literal numbers (2381.25 / 2536.25) and make `chartSpan` private. | S |
| 🟢 | code-quality | `android/src/features/current-month/components/realized-balance-sheet.tsx:249` | Hand-rolls `hasCents ? formatAmount : formatCompactAmount`, which is exactly the new `formatAdaptiveAmount` (`core/ui/amount-format.ts:85`). Pre-existing, made redundant by the branch. | Call `formatAdaptiveAmount` and drop the two imports. | S |
| 🟢 | ui | `android/src/core/ui/sheet.tsx:173` | The back arrow sits after the 24dp header padding: on the « Autre » step the title shifts right by 56dp versus the form step, the glyph lands ~36dp from the edge (MD3: 16dp). Unverified on device. | Reduce `paddingLeft` when the back button shows. | S |
| 🟢 | ui | `android/src/features/current-month/components/balance-trajectory-chart.tsx:107` | Only `.onUpdate` feeds the scrub: a finger held still after the 150ms hold shows no reading until it moves; iOS shows it at once. Pre-existing, unverified on device. | Add `.onStart` calling `onScrub(scrubDayAt(...))`. | S |
| 🟢 | performance | `android/src/features/current-month/components/balance-trajectory-chart.tsx:104` | `data`, `plan`, `projection`, `domain`, inline `yKeys` and `Gesture.Pan()` are rebuilt on each render, i.e. on every day crossed while scrubbing. Pre-existing pattern, no jank measured (≤32 points). | `useMemo` on `[trajectory]`, module-level `Y_KEYS`; only if a device shows jank. | S |
| 🟢 | code-quality | `android/src/core/ui/segmented-picker.tsx:63` | `accessibilityLabel={segment.label}` repeats the only Text child. | Drop the prop. | S |
| 🟢 | tests | `android/maestro/add-operation.yaml:28` | `tapOn: "Montant, en .*"` relies on the content-desc built by `common.amountInCurrency`; never run on a device in this branch. | One Maestro run, or a `testID` on `AmountField`. | S |
| 🟢 | ui | `android/DESIGN.md:94` | Says `SectionHeader` has a « Manrope title »; code uses MD3 `titleLarge` on the system face (`section-header.tsx:26`). Pre-existing doc drift. | Align the DESIGN.md line. | S |
| 🟢 | code-quality | `android/src/core/ui/sheet.tsx:149`, `segmented-picker.tsx:66`, `section-header.tsx:41` | Changes to shared atoms not in the plans (backdrop no longer an a11y target, selected-segment hairline border, header role moved to the title). Each is tested; the border was never compared with iOS on device. | Name them in the PR body; check the border on device. | S |
| 🟢 | code-quality | `shared/src/calculators/balance-trajectory.ts:224` | `trendBalance` runs in float, iOS in `Decimal`: at an exact half-cent the trend can differ by 0.01, and the unit-rounded text by 1. Pre-existing and systemic to every TS/Swift mirror; this branch only starts passing `history` on Android, as iOS does. Found by Codex, not reproduced. | Separate task: decide on cents arithmetic for the shared calculators, with mirror tests. | M |
| 🟢 | code-quality | `aidd_docs/tasks/2026_11/2026_11_17_android-home-hero-ios-parity/phase-1.md:57` | Plan phases keep the old verdict text, weight 600 and the old domain rule, which the branch changed later. Found by Codex. | Record the final decisions in phase-1 and phase-2. | S |

## Top actions

1. Interpolate the scrub figure in cents (code-quality, 🟡).
2. Restore the window/keyboard guard in `sheet.spec.tsx` with a `.fontScale` exemption (tests, 🟡).
3. Small cleanups in one commit: literal chart-domain assertions + private `chartSpan`, `formatAdaptiveAmount` in realized-balance-sheet, drop the redundant segment label, DESIGN.md line, scrub `.onStart`.
4. One emulator pass: « Autre » header alignment, selected-segment border, `add-operation.yaml`.

## Coverage

- **Scanned**: code-quality, architecture, security, dependencies, performance, tests, ui
- **Skipped**: none (limits: no coverage tool, no profiler, no automated a11y scan, no device run in this audit)
