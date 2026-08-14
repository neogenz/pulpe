---
status: done
---

# Instruction: remove-one-off-capture-and-keep-contract-tests

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ios
│   ├── PulpeUITests
│   │   ├── BudgetLineLongPressTests.swift                       ✏️ revert capture-commit-only actor annotation if compilation permits
│   │   ├── LoginFlowTests.swift                                 ✏️ revert capture-commit-only actor annotation if compilation permits
│   │   ├── PulpeUITests.swift                                   ✏️ revert capture-commit-only actor annotation if compilation permits
│   │   └── SavingsGoalsSeedWorkflowTests.swift                  ❌ delete local demo capture test
│   └── scripts/capture-savings-goals-workflow.sh                ❌ delete local demo capture script
└── shared/src
    ├── savings-goal-pul12.spec.ts                               ❌ remove ticket-coded path through rename
    └── savings-goal-schema.spec.ts                              ✅ renamed durable schema contract suite
```

## Tasks to do

### `1)` Remove the local iOS demo-capture harness

> The script and UI test are a coupled, non-CI workflow for producing demo screenshots/video from a seeded account; they are not product regression coverage.

1. Move `ios/scripts/capture-savings-goals-workflow.sh` and `ios/PulpeUITests/SavingsGoalsSeedWorkflowTests.swift` to Trash together.
2. Remove the three `@MainActor` additions made only as collateral in the capture commit, unless the existing UI-test target fails to compile without them.
3. Keep the stable accessibility identifiers in savings views: they are low-cost automation seams and are not secret/capture infrastructure.
4. Confirm no source or project configuration references the deleted script/test.

### `2)` Preserve schema regression coverage under an intentional name

> The 22 assertions cover target-date bounds, PATCH semantics, strict plan payloads, and `savingsGoalId` propagation through shared schemas.

1. Rename `shared/src/savings-goal-pul12.spec.ts` to `shared/src/savings-goal-schema.spec.ts` without weakening assertions.
2. Remove the duplicated consecutive `expect(result.success).toBe(true)` assertion found in the omission case.
3. Run the renamed shared suite and confirm Vitest discovers it through `src/**/*.spec.ts`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | No committed test requires capture credentials or creates demo media; the ordinary iOS UI-test target still compiles. |
| 2 | All schema contract cases still pass under the responsibility-based filename, with no duplicated assertion. |
