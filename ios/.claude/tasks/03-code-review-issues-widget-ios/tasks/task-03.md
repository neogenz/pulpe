# Task: Add UIBackgroundModes for BGTaskScheduler

## Problem

The app declares `BGTaskSchedulerPermittedIdentifiers` in `project.yml` for widget background refresh, but `UIBackgroundModes` is NOT configured. Per Apple documentation, BGTaskScheduler requires UIBackgroundModes to be declared for the scheduler to function.

Without this configuration, any BGTaskScheduler-based background refresh will silently fail to execute.

## Proposed Solution

Add `UIBackgroundModes` array with `fetch` value to `project.yml` before the existing `BGTaskSchedulerPermittedIdentifiers` entry. After modification, regenerate the Xcode project with `xcodegen generate`.

## Dependencies

- None (can start immediately)
- Can be done in parallel with Tasks 1 and 2
- **IMPORTANT**: After this change, must run `xcodegen generate`

## Context

- Key file: `ios/project.yml:95-96`
- Current config has:
  ```yaml
  BGTaskSchedulerPermittedIdentifiers:
    - app.pulpe.ios.widget-refresh
  ```
- Missing: `UIBackgroundModes: [fetch]`
- Apple docs: "BGTaskSchedulerPermittedIdentifiers must contain identifiers when UIBackgroundModes has 'processing' or 'fetch'"

## Success Criteria

- `project.yml` contains both `UIBackgroundModes` and `BGTaskSchedulerPermittedIdentifiers`
- `xcodegen generate` runs successfully
- `xcodebuild` build succeeds
- Generated `Info.plist` contains both keys (verify in Xcode or via `plutil`)
