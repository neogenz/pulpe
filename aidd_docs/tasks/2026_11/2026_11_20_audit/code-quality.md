# Codebase Audit: code-quality (PR #915, cbe305587..213322c41)

One half-cent rounding gap with iOS in the new scrub, two small duplications, stale plan criteria.

- **Date**: 2026_11_20
- **Scope**: diff of branch claude/android-home-hero-ios-parity-e3c75b against main, read with callers and neighbours
- **Health**: fair
- **Findings**: 0 critical, 1 major, 5 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟡 | code-quality | `android/src/features/current-month/balance-scrub.ts:97` | Scrub interpolation rounds in float: halfway between 2 and −1.99 gives `0.004999…` → 0.00, iOS `Decimal.rounded(2)` gives 0.01. Introduced; reproduced in node. Found by Codex. | Interpolate in integer cents, then round half away from zero; add the 2 / −1.99 case to the spec. | S |
| 🟢 | code-quality | `android/src/features/current-month/components/realized-balance-sheet.tsx:249` | Hand-rolls `hasCents ? formatAmount : formatCompactAmount`, which is exactly the new `formatAdaptiveAmount` (`core/ui/amount-format.ts:85`). Pre-existing, made redundant by the branch. | Call `formatAdaptiveAmount` and drop the two imports. | S |
| 🟢 | code-quality | `android/src/core/ui/segmented-picker.tsx:63` | `accessibilityLabel={segment.label}` repeats the only Text child. | Drop the prop. | S |
| 🟢 | code-quality | `android/src/core/ui/sheet.tsx:149`, `segmented-picker.tsx:66`, `section-header.tsx:41` | Changes to shared atoms not in the plans (backdrop no longer an a11y target, selected-segment hairline border, header role moved to the title). Each is tested; the border was never compared with iOS on device. | Name them in the PR body; check the border on device. | S |
| 🟢 | code-quality | `shared/src/calculators/balance-trajectory.ts:224` | `trendBalance` runs in float, iOS in `Decimal`: at an exact half-cent the trend can differ by 0.01, and the unit-rounded text by 1. Pre-existing and systemic to every TS/Swift mirror; this branch only starts passing `history` on Android, as iOS does. Found by Codex, not reproduced. | Separate task: decide on cents arithmetic for the shared calculators, with mirror tests. | M |
| 🟢 | code-quality | `aidd_docs/tasks/2026_11/2026_11_17_android-home-hero-ios-parity/phase-1.md:57` | Plan phases keep the old verdict text, weight 600 and the old domain rule, which the branch changed later. Found by Codex. | Record the final decisions in phase-1 and phase-2. | S |

## Top actions

1. Interpolate the scrub figure in integer cents.
2. Replace the hand-rolled formatter with `formatAdaptiveAmount` (realized-balance-sheet) and drop the redundant label (segmented-picker).
3. List the shared-atom changes in the PR body.

## Coverage

- **Scanned**: code-quality (naming, dead code after the chip removal, catalog key parity, duplication, plan vs actual scope)
- **Skipped**: none
