---
description: Pure calculators mirrored TypeScript ↔ Swift — edit one side, edit the other
paths:
  - "shared/src/calculators/**/*.ts"
  - "ios/Pulpe/Domain/Formulas/**/*.swift"
  - "ios/PulpeTests/Domain/Formulas/**/*.swift"
---

# Formula Mirrors (TypeScript ↔ Swift)

## Rule

`shared/src/calculators/` is the source of truth for every business formula.
Six of its files have a hand-written Swift twin in `ios/Pulpe/Domain/Formulas/`.

**Changing a formula on one side is a change on BOTH sides, plus both test suites, in the same commit.** A silent divergence does not fail any build: web and iOS simply display two different amounts for the same account, and nobody finds out until a user does.

## The mirrored pairs

| TypeScript (source of truth)                  | Swift twin                                               |
| --------------------------------------------- | -------------------------------------------------------- |
| `shared/src/calculators/budget-formulas.ts`   | `ios/Pulpe/Domain/Formulas/BudgetFormulas.swift`         |
| `shared/src/calculators/budget-period.ts`     | `ios/Pulpe/Domain/Formulas/BudgetPeriodCalculator.swift` |
| `shared/src/calculators/spread-split.ts`      | `ios/Pulpe/Domain/Formulas/SpreadSplit.swift`            |
| `shared/src/calculators/savings-goal-plan.ts` | `ios/Pulpe/Domain/Formulas/SavingsPlanCalculator.swift`  |
| `shared/src/calculators/balance-trajectory.ts` | `ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift`     |
| `shared/src/calculators/spread-progress.ts`   | `ios/Pulpe/Domain/Formulas/SpreadProgress.swift`         |

The mapping is **per function, not strictly per file**: `suggestedMonthlyContribution` lives in `savings-goal-progress.ts` on the TS side and in `SavingsPlanCalculator.swift` on the Swift side. Grep the function name across both trees before assuming it has no twin.

## What is deliberately NOT mirrored

`buildSavingsGoalTimeline` (`savings-goal-plan.ts`) runs **server-side only**. The server sends the finished `months[]` on `GET /savings-goals/:id/progress` and iOS consumes it; the client never rebuilds a timeline. Porting it to Swift would create a second authority on the same numbers.

Consequence, and the reason it bites: any correction to the stock has to travel **through the rows**, never through a client-local seed. The simulator and the redistribution only know of the stock what the rows carry (see `docs/SAVINGS.md` §10.3).

## Why a mirror at all

This is a deliberate break from "the client implements NO formula". The plan simulator gives a live preview while the user drags a slider — a round trip per keystroke is not an option. The mitigation is the pair itself: one tested calculator, one tested Swift twin, and this rule. Same doctrine as PUL-17 / spread.

Do not extend the doctrine. A **new** formula belongs server-side unless it must run under the user's finger; only then does it earn a twin, and it earns this rule with it.

## Checklist for any formula change

1. Edit the TypeScript calculator + its `*.spec.ts`.
2. Edit the Swift twin + its suite in `ios/PulpeTests/Domain/Formulas/`.
3. Give both suites the **same numeric fixture**, so a divergence shows up as a failing assertion and not as a reading exercise.
4. Run both: `cd shared && pnpm test` and the iOS `PulpeTests` target.
5. If the change alters the shape of a payload the server sends, update `ios/Pulpe/Domain/Models/SavingsGoalPlan.swift` too — it decodes what the timeline produces.

## Anti-patterns

| Don't                                              | Do                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Patch the TS calculator, "iOS will follow later"   | Both sides in the same commit                                           |
| Add a formula to Swift with no TS counterpart      | Server-side first; a twin only when it must run under the user's finger |
| Mirror the code but not the fixture                | Same numbers on both sides, so a drift fails a test                     |
| Assume a file with no `Port of` header has no twin | Grep the function name across both trees                                |

## Reference

- Business source of truth: `docs/SAVINGS.md`, `docs/SPREAD.md`
- Decision rationale: `docs/adr/0016-mirror-interactive-formulas-typescript-swift.md`
- Header comments naming each pair: the four Swift files above
