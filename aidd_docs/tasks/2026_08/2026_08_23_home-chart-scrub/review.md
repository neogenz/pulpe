# Review: home-chart-scrub

- **Verdict**: approve (findings fixed in the follow-up commit)
- **Diff**: `3b79403b4...0e4ef19c4`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_23
- **Findings**: 0 critical, 1 warning, 3 minor

## Phases

### Phase 1 — Lecture du jour et règle de scrub

| # | Criterion | State | Evidence |
| - | --------- | ----- | -------- |
| 1.1 | `ScrubReading { day, date, real?, plan, estimate? }` | [x] | `HomeHeroCard+Scrub.swift:10-16` |
| 1.1 | `scrubReading(at:in:)` clamps the day | [x] | `HomeHeroCard+Scrub.swift:24` `min(max(rawDay, 0), trajectory.totalDays)` ; test `HomeHeroCardScrubTests.swift:46-49` |
| 1.1 | plan interpolated `plannedAvailable` → `plannedBalance` | [x] | `HomeHeroCard+Scrub.swift:25` + `interpolate` `:76-84` over `plan(for:)` `HomeHeroCard+Chart.swift:266-273` |
| 1.1 | `real[day]` read point by point | [x] | `HomeHeroCard+Scrub.swift:26` |
| 1.1 | projection interpolated after today only | [x] | `HomeHeroCard+Scrub.swift:27` `day > trajectory.today` |
| 1.2 | `scrubBubbleText` « jour · Réel X · Prévu Y » / « … Estimé X … » | [x] | `HomeHeroCard+Scrub.swift:40-50`, separator ` · ` |
| 1.2 | 4 locales | [x] | source fr + `de`/`en`/`it` for `Estimé %@` and `Réel %@`, `Localizable.xcstrings:11938-11957`, `:21982-22001` |
| 2.1 | `LongPressGesture(0.15).sequenced(before: DragGesture(minimumDistance: 0))` in `.chartOverlay` | [x] | `HomeHeroCard+Scrub.swift:60-73`, `HomeHeroCard+Chart.swift:184` ; 0.15 tokenized `DesignTokens+Chart.swift:19-21` |
| 2.1 | `proxy.value(atX:) as Int?` → `scrubDay`, end → nil | [~] | `HomeHeroCard+Scrub.swift:66-71` — works, but first `.second(true, nil)` update resolves x to 0 (finding F1) |
| 2.1 | `.sensoryFeedback(.selection, trigger: scrubDay)` | [x] | `HomeHeroCard+Chart.swift:185` |
| 2.2 | `RuleMark` thin in `heroInkSecondary`, bubble `caption2` / `heroInk` on `heroSurface` capsule, `overflowResolution .fit(to: .chart)` | [x] | `HomeHeroCard+Chart.swift:158-177` |
| 2.2 | dot on the real/estimate value | [x] | `HomeHeroCard+Chart.swift:178-185` + `scrubDotValue` `HomeHeroCard+Scrub.swift:54-56` |
| 2.3 | fixed labels get `opacity(scrubDay == nil ? 1 : 0)` | [x] | `labelOpacity` `HomeHeroCard+Chart.swift:256` applied `:46`, `:127`, `:155` (Prévu, tendance, Aujourd’hui) |
| 2.4 | `swiftlint --strict` clean | [x] | `swiftlint lint --strict` on the 3 Swift files → no output, exit 0 |
| 1 acc. | 5 tests green on readings and text | [~] | 5 `@Test` present `HomeHeroCardScrubTests.swift:23,32,39,46,53`; assertions hand-checked against `plan(for:)`/`projection(for:)`/`interpolate` and all hold. **Not executed**: only sim available is Maxime's booted interactive one |
| 2 acc. | Screenshot mid-scrub + vertical scroll on device | not-applicable | needs a device/simulator run, cannot be verified statically |

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | code | 1 | `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard+Scrub.swift:67-70` | `SequenceGesture` emits `.second(true, nil)` the instant the long press succeeds. `drag?.location.x ?? origin.x` then `- origin.x` yields `x = 0` → `scrubDay = 0`. The rule, bubble and dot flash on pay day (leftmost) and fire a `.selection` haptic before jumping to the finger on the next update. | `guard case .second(true, .some(let drag)) = value, let frame = proxy.plotFrame else { return }` and drop the `?? origin.x` fallback — no reading until the drag has a location |
| 🟢 | conform | 1 | `HomeHeroCard+Chart.swift:225` (`.sensitiveAmount()` on the whole `Chart`) | `SensitiveAmountModifier` is a `blur(radius: 8)` on the whole view (`Shared/Extensions/View+Extensions.swift:12-21`), so under amounts-hidden the bubble's **date** is blurred too. `brainstorm.md` states « la bulle hérite du masquage, **la date reste** ». Masking works, the intent does not. | Either drop the claim from the brainstorm, or split the bubble: date outside `sensitiveAmount()`, amounts inside |
| 🟢 | code | 1 | `HomeHeroCard+Scrub.swift:54-56` and `:10` | `scrubDotValue` is a one-line `reading.real ?? reading.estimate` with a single call site, and `ScrubReading: Equatable` is never compared (tests assert field by field). Speculative surface. | Inline the coalesce at `HomeHeroCard+Chart.swift:178`; drop `Equatable` until something needs it |
| 🟢 | code | 1 | `HomeHeroCard+Scrub.swift:71` | `.onEnded { _ in scrubDay = nil }` is the only reset. A sequence interrupted rather than ended (system gesture, incoming call) does not call `onEnded`, leaving the rule and bubble latched and the fixed labels hidden. | Also clear on `.onChanged` receiving `.first(_)`, or reset from `.onDisappear` / a `scenePhase` change |

Verified as correct, not findings:
- `.sensitiveAmount()` **does** cover the bubble: chart annotations render inside the `Chart` view, and the blur is applied above it (`HomeHeroCard+Chart.swift:225`).
- Date mapping is coherent with `chartTimeAxis`: `periodEnd = periodStart + totalDays - 1` (`Domain/Formulas/BalanceTrajectory.swift:46-48`), and `scrubReading` maps `day` → `periodStart + (day - 1)`, so day `totalDays` reads exactly the right-hand axis label. Day 0 and day 1 both read the left-hand label, which `dayMonthLabel` renders as « 1er août » — documented at `HomeHeroCard+Scrub.swift:28`.
- VoiceOver never sees the rule or the bubble: `.accessibilityElement(children: .ignore)` + `.accessibilityLabel(...)` sit after the chart body (`HomeHeroCard+Chart.swift:226-231`).
- Reduce motion: the two `.animation` modifiers are scoped to `value: trend` and `value: settlePulse`, so the rule follows the finger with no implicit animation.
- Lexicon and copy: « Réel », « Prévu », « Estimé » match CLAUDE.md vocabulary; no « transaction » on screen; `AppLocale.string("Réel \(…)")` resolves to key `Réel %@`, which exists with de/en/it.
- Tokens: `scrubHoldDuration`, `BorderWidth.thin`, `Spacing.sm/xxs`, `Chart.pointSymbolArea` — no magic numbers introduced.
- `asCompactCurrency` renders « 6’900 CHF » (whole number, U+2019), matching the wireframe; not the proscribed-in-Budget-Detail case.

## Verification

| Metric | Value |
| ------ | ----- |
| Verified | 14 of 15 criteria fulfilled, 1 not-applicable (device) |
| Files checked | `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard+Scrub.swift`, `HomeHeroCard+Chart.swift`, `HomeHeroCard.swift`, `ios/Pulpe/Shared/Design/DesignTokens+Chart.swift`, `ios/Pulpe/Resources/Localizable.xcstrings`, `ios/PulpeTests/Features/CurrentMonth/HomeHeroCardScrubTests.swift`, `ios/Pulpe/Shared/Extensions/View+Extensions.swift`, `ios/Pulpe/Shared/Extensions/Decimal+Extensions.swift`, `ios/Pulpe/Shared/Formatters/Formatters.swift`, `ios/Pulpe/Shared/Localization/AppLocale.swift`, `ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift` |
| Unchecked | `2 acc.` screenshot mid-scrub + vertical scroll — not-applicable (needs a device run); `1 acc.` tests not executed — no dedicated test simulator, only Maxime's booted interactive sim |
| Unplanned | none |
