---
status: done
---

# Instruction: Repair title names only the months it writes

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Features/
    │   │   └── SavingsGoals/
    │   │       └── Components/
    │   │           └── GoalPlanTimelinePresentation.swift ✏️
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── SavingsGoals/
                └── GoalPlanWordingTests.swift ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup | From `ios/`, run `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath .build/dd-unit CODE_SIGNING_ALLOWED=NO -only-testing:PulpeTests/GoalPlanWordingTests` | The suite runs with an executed count above zero | cli |
| Happy path | `repairTitle` with repairable months 3, 4, 5 of 2026 | « Planifier mars à mai », the range title as today | cli |
| Edge case | Repairable months 3, 5, 6 (avril missing) | `AppLocale.string("Planifier \(3) mois")`, no range | cli |
| Edge case | Repairable months 3 and 5 | « Planifier mars et mai »: two months are both named, gap or not | cli |
| Edge case | Novembre 2026, décembre 2026, janvier 2027 | The range title across the year, not the count | cli |
| Edge case | No repairable month | `nil`, as today | cli |

## Tasks to do

### `1)` Count title when the months have a gap

> « Planifier mars à juin » must not cover a month the repair does not write.

1. In `repairTitle` (`GoalPlanTimelinePresentation.swift:106`), keep `rangeTitle(repairable, capitalized: false)` when `repairable.count <= 2` or when every month follows the previous one (`year * 12 + month` grows by 1 between neighbours).
2. Otherwise return `AppLocale.string("Planifier \(repairable.count) mois")`.
3. Update the doc comment above `repairTitle` to say both forms.
4. Leave `rangeTitle` untouched: its other callers pass contiguous runs.

### `2)` Catalog key

> The count title exists in the four languages.

1. Add `Planifier %lld mois` to `Localizable.xcstrings`, shaped like the `Planifier %@` entry: fr « Planifier %lld mois », en « Plan %lld months », de « %lld Monate planen », it « Pianifica %lld mesi ».

### `3)` Tests

> A gap, a pair, a full run and a year wrap each have a failing-when-broken test.

1. In `GoalPlanWordingTests.swift`, give the `month(...)` helper a `year: Int = 2026` parameter.
2. Add the cases of Test Scope next to `repairTitle_onlyRepairableMonths`.
3. Run the suite with the Setup command and read the executed count.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1    | Months 3, 5, 6 give the count title; months 3, 4, 5 and a year wrap give the range title; `rangeTitle` has no diff |
| 2    | `Planifier %lld mois` has fr, en, de and it values in the catalog |
| 3    | `GoalPlanWordingTests` passes with every new case executed |
