# Review: Android home hero parity with iOS

## Round 1

- Diff: `cbe305587...213322c41` (also covers `2026_11_18_android-ux-audit-fixes`, merged on this branch)
- Uncommitted changes: no
- Axes: code, functional, relevancy
- Verdict: changes-requested, because two major findings: a deleted repo-wide regression guard and a half-cent scrub rounding gap with iOS

### Criteria

- [x] Hero chart model, scrub, verdict copy, adaptive decimals and a11y label match iOS — `balance-trajectory-chart.tsx`, `balance-scrub.ts`, `home-hero-presentation.ts`, specs green
- [x] Verdict dated on what is left, same wording on iOS and Android in 4 locales — 03b291338, `HeroVerdictPresentation.swift`
- [x] Chart y-domain frames what is drawn, mirrored on iOS with tests — 0778de7d2
- [ ] Scrub figure matches iOS to the cent — halfway between 2 and −1.99 Android shows 0.00, iOS 0.01 (`balance-scrub.ts:97`)
- [x] Scrub haptic ticks once per day crossed, even before a render — 213322c41, `home-hero-card.scrub.spec.tsx`
- [x] Verdict semibold — Android 700, documented adaptation
- [x] UX phase 1: budget captions as iOS, PIN dots ≥ 3:1, PIN subtitle from xcstrings — 4 catalogs, 1447 identical keys, no `potential`/`adjustment` key left
- [x] UX phase 2: visible back from the « Autre » picker — `sheet.tsx:173`, `transaction-sheet.tsx:408`
- [x] UX phase 3: point circle sibling of the row, 48dp targets, large-text wrapping — `budget-line-row.tsx`, `segmented-picker.tsx`, `section-header.tsx`
- [x] UX phase 4: quick amount chips removed — no `QuickAmount` reference left in `android/`
- [x] Checks at 213322c41: type-check 0, lint 0, prettier OK, Jest 208 suites / 1379 tests
- Unverified at runtime: « Autre » header alignment and selected-segment border — an emulator capture
- Unverified at runtime: `maestro/add-operation.yaml` regex on the amount content-desc — one Maestro run

### Assumptions

- The plan fallback of the scrub dot is unreachable — holds, `realSeries` emits one point per day up to today, checked at `shared/src/calculators/balance-trajectory.ts:283`
- New a11y labels never leak amounts — holds, they go through the masking formatters, checked at `android/src/core/ui/amount-format.ts:85`

### Findings

- `android/src/features/current-month/balance-scrub.ts:97` : float interpolation rounds `0.004999…` to 0.00 where iOS `Decimal` gives 0.01, proof `HomeHeroCard+Scrub.swift:93` → interpolate in integer cents, spec case 2 / −1.99 — 🟡 major
- `android/src/core/ui/sheet.spec.tsx:113` : the "never measures the window without also asking for the keyboard" guard was deleted in 38632f34d instead of exempting the two `.fontScale` readers, proof `segmented-picker.tsx:41`, `budget-line-row.tsx:53` → restore it with a `.fontScale` exemption — 🟡 major
- `android/src/features/current-month/balance-chart-scale.spec.ts:89` : expected domain rebuilt from `chartSpan`, which is exported only for this test, proof `balance-chart-scale.ts:77` → literal assertions, private `chartSpan` — 🟢 minor
- `android/src/features/current-month/components/realized-balance-sheet.tsx:249` : hand-rolled adaptive formatting, proof `amount-format.ts:85` → `formatAdaptiveAmount` — 🟢 minor
- `android/src/core/ui/sheet.tsx:173` : back arrow after the 24dp padding shifts the title 56dp between steps, proof `sheet.tsx:258` → smaller `paddingLeft` with the back button — 🟢 minor
- `android/src/features/current-month/components/balance-trajectory-chart.tsx:107` : a still finger shows no reading until it moves, iOS shows it at once → `.onStart` — 🟢 minor
- `android/src/core/ui/segmented-picker.tsx:63` : redundant `accessibilityLabel` → drop — 🟢 minor
- `android/DESIGN.md:94` : « Manrope title » vs `titleLarge` in `section-header.tsx:26` → align the doc — 🟢 minor

- `aidd_docs/tasks/2026_11/2026_11_17_android-home-hero-ios-parity/phase-1.md:57` : plan keeps the old verdict text and weight 600 → record the final decisions — 🟢 minor

### Limits

- `trendBalance` float vs iOS `Decimal` at an exact half-cent (pre-existing, every shared calculator) — a mirror test with a half-cent case

- No device or emulator run in this round — one pass on the emulator settles the two UI doubts and the Maestro flow
- Scrub re-render cost not profiled — a sweep on a low-end device

## Round 2

- Diff: `213322c41...HEAD` (two fix commits)
- Uncommitted changes: no
- Axes: code, functional
- Verdict: approve, because both majors of round 1 are fixed with a test that fails on the old code; only minor findings remain

### Criteria

- [x] Scrub figure matches iOS to the cent — `balance-scrub.ts` interpolates in whole centimes; spec "rounds a half centime across zero like iOS" fails on 213322c41 (received 0, expected 0.01), passes now
- [x] Window/keyboard guard back — `sheet.spec.tsx`, exempts `useWindowDimensions().fontScale` reads only
- [x] Checks: type-check 0, lint 0, prettier OK, Jest 208 suites / 1381 tests

### Limits

- Round 1 minors and the device-only doubts stay open

## Round 3

- Diff: `4a8c02fa0...HEAD` (round 1 minors)
- Uncommitted changes: no
- Axes: code, functional
- Verdict: approve, because the fixed minors carry tests and the rest are left on purpose

### Criteria

- [x] Scrub reads the day as soon as the hold activates — `.onStart` in `balance-trajectory-chart.tsx`; spec "reads the day under a held finger before it moves" fails without it
- [x] Chart-domain test asserts literal bounds; `chartSpan` private again
- [x] `realized-balance-sheet.tsx` uses `formatAdaptiveAmount`; redundant segment label dropped; DESIGN.md and plan phases match the code
- [x] Checks: type-check 0, lint 0, prettier OK, Jest 208 suites / 1382 tests

### Limits

- Left on purpose: chart memoization (no jank measured), « Autre » header padding and segment border (need an emulator), Maestro `add-operation` (runs in the Android CI smoke), shared-atom list in the PR body, float vs `Decimal` in the shared calculators (separate task)
