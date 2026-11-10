---
status: done
---

# Instruction: Goal chart keeps amounts unspoken when hidden

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   └── Features/
    │       └── SavingsGoals/
    │           └── Components/
    │               └── GoalProjectionChart.swift ✏️
    └── PulpeTests/
        └── Features/
            └── SavingsGoals/
                └── GoalProjectionChartTests.swift ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup | From `ios/`, run `xcodegen generate --use-cache`, then `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath .build/dd-unit CODE_SIGNING_ALLOWED=NO -only-testing:PulpeTests/GoalProjectionChartTests` | The new suite runs with an executed count above zero | cli |
| Happy path | `accessibilitySummary` with `amountsHidden: true` | « Montant masqué », and no amount of the series in the string | cli |
| Edge case | `amountsHidden: false`, series with a target | « Épargné …, projection planifiée …, cible … », as today | cli |
| Edge case | `amountsHidden: false`, series without target | « Épargné …, projection planifiée … », as today | cli |

## Tasks to do

### `1)` Make the summary follow `amountsHidden`

> VoiceOver says what the screen shows: nothing more when amounts are masked.

1. In `GoalProjectionChart` (`GoalProjectionChart.swift:11`), read `@Environment(\.amountsHidden) private var amountsHidden`.
2. Turn the `accessibilitySummary` property (`:106`) into `static func accessibilitySummary(series: GoalProjectionSeries, currency: SupportedCurrency, amountsHidden: Bool) -> String`, returning `AppLocale.string("Montant masqué")` first when hidden. The key exists in the four languages.
3. Call it in `.accessibilityValue(...)` (`:99`). Same shape as `HomeHeroCard.chartAccessibilityLabel(for:currency:amountsHidden:)`.
4. `GoalPlanSimulatorSheet.swift:77` needs no change: the value comes from the environment.

### `2)` Tests

> The hidden branch has a test that fails if an amount leaks.

1. Create `ios/PulpeTests/Features/SavingsGoals/GoalProjectionChartTests.swift`, a `@MainActor @Suite`, building series like `GoalProjectionSeriesTests`, with the three cases of Test Scope.
2. From `ios/`, run `xcodegen generate --use-cache`, then the suite, and read the executed count.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1    | With amounts hidden the chart's accessibility value is « Montant masqué »; with amounts shown it is unchanged |
| 2    | `GoalProjectionChartTests` passes with three tests executed |
