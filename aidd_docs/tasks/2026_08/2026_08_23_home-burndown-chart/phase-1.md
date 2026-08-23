---
status: pending
---

# Instruction: Série réel et disponible prévu

## Architecture projection

```txt
ios/Pulpe/Domain/Formulas
└── BalanceTrajectory.swift                       ✏️ `plannedAvailable`, `real: [Point]`, `realSeries(...)`
ios/PulpeTests/Domain/Formulas
└── BalanceTrajectoryTests.swift                  ✏️ real series tests
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Happy path
    nothing pointed => real is flat at plannedAvailable through today: 5: system
    expense line pointed on day 5 => real drops by the line amount from day 5 on: 5: system
    checked transaction day 8 on an unchecked line => real drops by the transaction from day 8: 5: system
  section Edge case
    unchecked transaction => real unchanged (pointé is the only signal): 1: system
    last point equals plannedAvailable − realizedExpenses of the full set: 1: system
```

## Tasks to do

### `1)` `plannedAvailable`

1. Stored property on `BalanceTrajectory`, set from `calculateAllMetrics(budgetLines:transactions: [], rollover:).available` (income lines + rollover, no transactions).

### `2)` `real` series

1. `realSeries(budgetLines:transactions:rollover:periodStart:today:)`: for `day in 0...today`, `plannedAvailable − calculateRealizedExpenses(budgetLines: lines whose checkedAt < periodStart + day (else treated unchecked), transactions: checked transactions with transactionDate < periodStart + day)`. Day `today` takes every checked item untouched (mirror of `landingSeries`).
2. A line "treated unchecked" = copy with `checkedAt: nil` (use `toggled()` only if checked; otherwise build the copy explicitly).
3. Tests listed above; `BalanceTrajectory` initializer callers in tests updated.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `plannedAvailable == 5_000` on the shared fixture |
| 2 | `BalanceTrajectoryTests` green with 4 new tests; `swiftlint --strict` clean |
