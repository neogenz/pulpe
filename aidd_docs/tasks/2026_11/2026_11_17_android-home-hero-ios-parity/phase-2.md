---
status: done
---

# Instruction: Burn-down chart, scrub, spoken trajectory

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── core/
        │   └── i18n/
        │       ├── phase4-home-hero-i18n.spec.ts ✏️
        │       └── catalogs/
        │           ├── fr.json ✏️
        │           ├── en.json ✏️
        │           ├── de.json ✏️
        │           └── it.json ✏️
        └── features/
            └── current-month/
                ├── current-month-view-model.ts ✏️
                ├── current-month-view-model.spec.ts ✏️
                ├── balance-chart-scale.ts ✏️
                ├── balance-chart-scale.spec.ts ✏️
                ├── balance-scrub.ts ✏️
                ├── balance-scrub.spec.ts ✏️
                ├── home-hero-presentation.ts ✏️
                ├── home-hero-presentation.spec.ts ✏️
                └── components/
                    ├── balance-trajectory-chart.tsx ✏️
                    ├── balance-trajectory-chart.spec.tsx ✏️
                    ├── home-hero-card.tsx ✏️
                    └── home-hero-card.spec.tsx ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | trajectory fixture: `plannedAvailable` 5000, `plannedBalance` 2500, `real` falling day 0 to today, `totalDays` 31, a `trend` | pure helpers callable | cli |
| Happy path | read the plan, the projection and the y domain | plan `[(0, 5000), (31, 2500)]`, projection from the last real reading to `(31, trend)`, domain containing every plotted value | cli |
| Happy path | scrub a lived day, then a day to come | real reading with the interpolated plan; estimate interpolated on the projection, no real | cli |
| Happy path | build the view model with a drift history in the budget details | the trajectory's trend is `trendBalance(trajectory, 7, history)`, not the history-less one | cli |
| Edge case  | no history in the budget details | trend is `trendBalance(trajectory, 7)` | cli |
| Edge case  | last day of the period | no projection, no pace, the trend not spoken | cli |
| Edge case  | quiet month (amplitude under 5 % of planned outflows) | domain wider than the floor, three quarters of the slack below the readings | cli |
| Edge case  | scrub outside the period (day -3, day 99) | clamped to 0 and `totalDays` | cli |
| Edge case  | amounts hidden | eyebrow without the plan amount, spoken label is the masked sentence | cli |

## Tasks to do

### `1)` The trajectory carries its trend, history included

> The dashed stroke and the pace sentence quote the number iOS quotes, for an account with closed months too.

1. In `current-month-view-model.ts`, export `interface TrendedTrajectory extends BalanceTrajectory { trend: number }` and move `TREND_PRIOR_DAYS` here from `home-hero-presentation.ts`. `buildCurrentMonthViewModel` reads `history` from the budget details and returns `trajectory` as a `TrendedTrajectory | null` whose `trend` is `trendBalance(trajectory, TREND_PRIOR_DAYS, history)` (mirror of `BalanceTrajectory.history` and `trendBalance(priorDays:)` in `ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift`).
2. Cover it in `current-month-view-model.spec.ts`: with a history, without one.

### `2)` Chart geometry, ported from `HomeHeroCard+Chart.swift`

> The pure helpers describe the iOS drawing: plan diagonal, real stroke, projection to the trend.

1. In `balance-chart-scale.ts`, delete `chartSeries` and `ChartPoint`. Every helper below takes a `TrendedTrajectory` and reads `trajectory.trend`; none calls `trendBalance`.
2. Add `chartPlan(trajectory)`: `[{ day: 0, balance: plannedAvailable }, { day: totalDays, balance: plannedBalance }]`.
3. Add `chartProjection(trajectory)`: empty when `today >= totalDays` or `real` is empty, else `[lastReal, { day: totalDays, balance: trend }]`.
4. Port `span` and `chartYDomain`: plotted values are both plan ends, every `real` balance and the trend; span floored at `plannedOutflows * 0.05`; slack split one quarter above, three quarters below; padding `max(span * 0.12, 1)`. Export `chartSpan`. Rewrite the doc comment above `chartYDomain`: the « Unlike the iOS twin » sentence no longer holds, the function is a port.
5. Add `showsTrendLabel(trajectory)`: projection non-empty and `|trend - plannedBalance|` both `> 0` and `>= chartSpan * 0.08`.
6. Rewrite `balance-chart-scale.spec.ts` for these helpers; `todayCaptionLeft` and its tests stay untouched.

### `3)` Scrub reading, ported from `HomeHeroCard+Scrub.swift`

> A day under the finger reads the stroke it belongs to, and the eyebrow says which.

1. In `balance-scrub.ts`, `ScrubReading` becomes `{ day, date, real: number | null, plan: number, estimate: number | null }`: plan interpolated on `chartPlan`, real read point by point, estimate interpolated on `chartProjection` only for `day > today` (null when there is no projection), interpolations rounded to the centime.
2. Add `scrubFigure(reading)` = `real ?? estimate ?? plan`, and `scrubEyebrow(t, locale, reading, currency, amountsHidden)`: `home.hero.scrub.real` when the reading has a real value, `home.hero.scrub.estimated` otherwise, their `WithPlan` form (plan through `formatCompactCurrency`) unless amounts are hidden. Keep `scrubDayAt` and the date rule (day 0 and day 1 both read as the period's first day).
3. In the four catalogs add `home.hero.scrub.real` and `home.hero.scrub.realWithPlan` (`Réel le %{date}`, `Réel le %{date} · Prévu %{amount}`), en, de, it composed from the iOS entries `Réel le %@` and `%@ · Prévu %@` of `Localizable.xcstrings`, the way the existing `estimatedWithPlan` is.
4. Rewrite `balance-scrub.spec.ts`: readings, clamping, figure, the four eyebrow forms. The scrub is tested through these pure functions; no spec drives the pan gesture.

### `4)` Spoken trajectory

> TalkBack hears the same strokes VoiceOver does.

1. In the four catalogs under `home.hero`, replace `chartAccessibility` with `chart.accessibility.{plannedAvailable, plannedEnd, realToday, trend, hidden}` (`Disponible prévu %{amount}.`, `Prévu fin de période %{amount}.`, `Réel aujourd'hui %{amount}.`, `Si tu continues, %{amount}.`, `Trajectoire d'atterrissage de la période, montants masqués.`); en, de, it from the iOS entries of the same French sentences; keep each catalog's existing apostrophe style.
2. In `home-hero-presentation.ts`, add `chartAccessibilityLabel(t, { trajectory, currency, amountsHidden })`: the masked sentence when hidden, else the three sentences with `formatAdaptiveCurrency`, plus the trend sentence with `formatCompactCurrency` when `showsTrendLabel`; joined by a space. `rhythmSentence` takes a `TrendedTrajectory` and reads `trajectory.trend` and `chartProjection` instead of calling `trendBalance` itself.
3. Cover it in `home-hero-presentation.spec.ts`: visible, trend too close to speak, masked; the pace sentence quotes `trajectory.trend`.

### `5)` Draw the burn-down

> The canvas shows the plan diagonal, the real stroke, the dashed projection and one dot.

1. In `balance-trajectory-chart.tsx`, feed `CartesianChart` with the `real` readings only (`{ day, real }` rows, `yKeys={["real"]}`), domain x `[0, totalDays]`, y `chartYDomain`.
2. Draw, in this order: the plan as a 1px dashed `[3, 3]` Skia line between the two `chartPlan` points in `hero.muted`; the real stroke as the 3px solid `Line` in `hero.ink`; the projection, when it exists, as a 3px dashed `[5, 4]` Skia line in `accent` at full opacity; the scrub rule in `hero.muted`; one dot (a `hero.surface` disc, then a smaller `hero.ink` disc) on the scrubbed reading (`scrubFigure`) when there is one, else on the last real reading.
3. Props: replace `ruleColor` and `scrubDay` with `reading: ScrubReading | null` and `accessibilityLabel: string`; colors come from `useHeroColors()`, `accent` stays a prop. Captions: first and last day in `hero.muted`, today in `hero.ink` at weight 600; the captions row and its measuring stay as they are.
4. Rewrite the component doc comment: it describes the burn-down, and keeps the reason labels sit under the canvas.
5. Update `balance-trajectory-chart.spec.tsx` (props, fixture with a trend) and `phase4-home-hero-i18n.spec.ts` (the chart no longer calls `t("home.hero.chartAccessibility")`; assert the presentation resolves `home.hero.chart.accessibility`).

### `6)` Hero card reads the new model

> While scrubbing, the eyebrow names the day and the stroke, the figure is the reading.

1. In `home-hero-card.tsx`, `trajectory` is a `TrendedTrajectory | null`; the figure is `scrubFigure(reading)` while scrubbing, the estimate at rest; the eyebrow is `scrubEyebrow(...)` while scrubbing.
2. Pass `reading` and `chartAccessibilityLabel(...)` to the chart; tick `hapticSelection()` when the scrubbed day changes to another day.
3. Update `home-hero-card.spec.tsx`: fixture with a trend, the haptics mock gains `hapticSelection`.

### `7)` Contributor checks

> Everything the repository requires before a pull request passes.

1. From `android/`: `pnpm run type-check`, `pnpm run lint`, `pnpm run format:check` (source: `android/package.json` `quality`).
2. From `android/`: `pnpm exec jest src/features/current-month src/core/ui src/core/i18n src/features/budgets src/features/net-worth` (source: task brief, touched suites and the two other `HeroVerdict` callers).
3. From the repository root: `pnpm test:lexicon` (source: `CLAUDE.md`).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | With a drift history in the budget details, `viewModel.trajectory.trend` equals `trendBalance(trajectory, 7, history)`; without one it equals `trendBalance(trajectory, 7)`; outside the period the trajectory stays `null` |
| 2 | `chartPlan` returns the opening amount at day 0 and the planned balance at `totalDays`; `chartProjection` starts on the last real reading, ends on `trajectory.trend` at `totalDays`, and is empty on the last day; `chartYDomain` contains every plotted value and puts three quarters of a quiet month's slack below |
| 3 | Scrubbing a lived day returns its real balance and the plan interpolated on the diagonal; a day after today returns no real and the projection's interpolated value; days are clamped to the period; `scrubFigure` prefers real, then estimate, then plan; `scrubEyebrow` returns the real or estimated form, with the plan unless amounts are hidden; the four catalogs carry the same keys |
| 4 | The label speaks planned available, planned end and real today, adds the trend only when it is visibly apart from the plan, and is the masked sentence when amounts are hidden |
| 5 | The chart renders with the new props, keeps its three captions and their positions, and exposes the label it is given on the `image` element |
| 6 | The card type-checks against the trended trajectory, renders the estimate at rest with its eyebrow, and its spec passes with the haptics mock |
| 7 | The three `android/` quality commands, the Jest run and `pnpm test:lexicon` exit 0 |
