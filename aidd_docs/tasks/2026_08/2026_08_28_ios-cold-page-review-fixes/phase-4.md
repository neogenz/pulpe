---
status: done
---

# Instruction: one-ci-run-proves-the-gates

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.github/workflows/ci.yml                                            ✏️ `smoke-ios` gets `needs: test-ios`
ios/PulpeUITests/BudgetDetails/BudgetOpensFromListUITests.swift     ✏️ title check scoped to `app.navigationBars.staticTexts`
```

## User Journey

```mermaid
flowchart TD
  A[Push the branch] --> B{CI Pipeline run created?}
  B -->|no| X[Actions blocked at account level: spending limit or usage; human checks GitHub billing]
  B -->|yes| C[test-ios: xcodebuild -version prints 26.6, picker prints the iOS 26 runtime, SwiftLint step green]
  C --> D[smoke-ios after test-ios: Executed 1 test, TEST SUCCEEDED]
  D --> E[ci-success green on PR 686]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    commit the two edits and push => a pull_request event on PR 686: 5: cli
  section Happy path
    gh run list --workflow ci.yml => a run for the head SHA exists: 5: cli
    gh run view --log test-ios => Xcode 26.6 and an iOS-26 runtime printed, SwiftLint step passed: 5: cli
    gh run view --log smoke-ios => Executed 1 test and TEST SUCCEEDED: 5: cli
  section Edge case - no run created
    no run within 5 min of the push => stop, plan blocked: only the account owner can read and lift the Actions spending limit: 1: cli
```

## Tasks to do

### `1)` Two small edits

> The smoke must not boot a second macOS runner when the unit job already failed, and the title check must look at the bar.

1. `smoke-ios: needs: test-ios`.
2. `app.navigationBars.staticTexts.matching(predicate).firstMatch`.

### `2)` Make the run happen and read it

> No `CI Pipeline` run was created for the 8 pushes of 2026-08-28 while CodeQL and Vercel received the same events; the workflow is `active`.

1. Push; if no run appears, the block is the account's Actions spending limit or usage (`/settings/billing/actions` needs the `user` scope): mark the plan `blocked` and stop.
2. When the run exists: read `xcodebuild -version` and the picked runtime in `test-ios`, `Executed 1 test` in `smoke-ios`, and `ci-success` on the PR.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| 1    | `smoke-ios` lists `needs: test-ios`; the smoke still passes locally on the dedicated simulator with the scoped title check  |
| 2    | The CI log of the head SHA shows Xcode 26.6, an iOS 26 runtime, a green SwiftLint step, `Executed 1 test`, and `ci-success` green |
