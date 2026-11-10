---
status: done
---

# Instruction: Full suites on the result, PR body up to date

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup | `xcrun simctl list devices available` | "Pulpe Tests" and "Pulpe Tests P7" are listed | cli |
| Happy path | From `ios/`, `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath .build/dd-unit CODE_SIGNING_ALLOWED=NO` | All tests pass; the count is 2616 plus the cases added by phases 1 to 3 | cli |
| Happy path | From `ios/`, `xcodebuild test -scheme PulpeUITests -destination 'platform=iOS Simulator,name=Pulpe Tests P7'` | 38 tests executed, 0 failure | cli |
| Happy path | From `ios/`, `swiftlint lint --strict` | No violation | cli |
| Edge case | A UI test fails | Rerun it alone on an idle machine; a failure that stays is traced to its cause, fixed when this branch caused it, reported with its decisive line otherwise | cli |
| Edge case | The PR body changed since it was last read | The edit starts from the live body, not from the local copy | cli |

## Tasks to do

### `1)` Run the full unit suite

> The three fixes break nothing else.

1. Run the unit command of Test Scope on "Pulpe Tests".
2. Read the executed test and suite counts in the output, not only the final status.

### `2)` Run the full UI suite on P7

> The whole suite has not run on "Pulpe Tests P7" since the « Rattraper » fix.

1. Run the UI command of Test Scope on "Pulpe Tests P7".
2. For each failure, rerun the test alone, then trace it: fix it in the phase that owns the code when this branch caused it, otherwise report it.

### `3)` Lint

> The tree stays clean under the strict lint.

1. From `ios/`, run `swiftlint lint --strict`.

### `4)` Update the PR body

> The Verification section states what ran, on which commit.

1. Only once the user has asked for the commit and the push of phases 1 to 3.
2. Read the live body of neogenz/pulpe#866 with `gh pr view 866 --json body`.
3. Replace the unit line, the P7 UI line and the swiftlint line of Verification with the new counts and the new commit; add one sentence per fix under « Fixes found on the way ». No follow-up list.
4. Write it back with `gh pr edit 866 --body-file`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1    | The unit suite passes on "Pulpe Tests" with a count at or above 2616 plus the new cases |
| 2    | The UI suite on "Pulpe Tests P7" executes 38 tests with 0 failure, or each remaining failure is reported with its cause |
| 3    | `swiftlint lint --strict` prints no violation |
| 4    | The live PR body gives the unit, P7 UI and lint results at the pushed commit |
