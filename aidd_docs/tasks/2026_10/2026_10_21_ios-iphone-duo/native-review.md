# Native baseline review

Evidence date: 2026-10-23. Phase 1 remains in progress; no Duo rendering is validated here.

## Source and toolchain

- Branch: `codex/ios-duo-native`, based on `origin/main` at `0e1b64afa587cd7794403883c01ac0458e0e545c`.
- Local Xcode: 26.6 (`17F113`); simulator SDK: 26.5; XcodeGen: 2.44.1.
- The local developer directory was selected per command, without changing the global setting.
- Installed simulator inventory has iOS 26.5 and older 18.x runtimes, with no iOS 27.1 or Duo device.
- The existing user simulator remains untouched. Local UI tests use the isolated `Pulpe Tests` device `E6A58690-8539-4A37-8E20-DE179B84166F`.

## Orientation prerequisite

`ios/project.yml` now declares portrait, landscape left and landscape right. Running
`xcodegen generate --use-cache` regenerated the same three orientations in
`ios/Pulpe/Resources/Info.plist`. iOS 18 deployment and iPhone device family 1 are unchanged.
No runtime orientation override was found in the iOS source.

| Check                                | Result                                                       |
| ------------------------------------ | ------------------------------------------------------------ |
| XcodeGen generation                  | Passed; second run reports unchanged cached project          |
| Generated plist orientation parity   | Passed: three expected orientations                          |
| Deployment/device target check       | Passed: iOS 18 / iPhone                                      |
| `git diff --check`                   | Passed                                                       |
| PulpeLocal generic simulator build   | Passed: exit 0 and `BUILD SUCCEEDED`, SDK 26.5               |
| PulpeProd unsigned device build      | Passed: exit 0 and `BUILD SUCCEEDED`, SDK 26.5, no signature |
| Duo screenshots and five-pose review | Not run; requires a verified SDK 27.1 runtime                |

Build data and package checkouts are isolated in `/private/tmp/pulpe-ios-duo-native-derived-data`
and `/private/tmp/pulpe-ios-duo-native-source-packages`. Local log:
`/private/tmp/pulpe-ios-duo-native-local-build.log`. The built simulator app plist confirms
`DTXcode=2660`, `DTSDKName=iphonesimulator26.5`, `MinimumOSVersion=18.0`,
`UIDeviceFamily=[1]` and the three declared orientations.

From `ios/`, the Local command was:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild build \
  -project Pulpe.xcodeproj -scheme PulpeLocal -configuration Local \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/pulpe-ios-duo-native-derived-data \
  -clonedSourcePackagesDirPath /private/tmp/pulpe-ios-duo-native-source-packages \
  CODE_SIGNING_ALLOWED=NO
```

The unsigned Prod command used the same paths and developer directory, with
`-scheme PulpeProd -configuration Prod -destination 'generic/platform=iOS'`,
`-disableAutomaticPackageResolution -skipPackageUpdates` and `CODE_SIGNING_ALLOWED=NO`.
Its log is `/private/tmp/pulpe-ios-duo-native-prod-build.log`. The device app plist confirms
`DTSDKName=iphoneos26.5`, iOS 18, iPhone family 1 and the same orientations; `_CodeSignature`
is absent. Neither build launched an application, changed simulator state or distributed an archive.

## Static inspection targets for native review

These are code observations, not proven visual defects.

| Surface       | Existing behavior to preserve or inspect                                                                                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MainTabView` | Four native tabs, independent typed stacks, shared budget destinations, foreign-keyboard inset handling.                                                                                                                                                                                |
| Home          | Preserve the current forest `HomeHeroCard`, its estimate and chart. The older mint description at `ios/DESIGN.md:437` conflicts with the current implementation and the Two-Zone Rule; it is not a visual target. Inspect the custom `ProfileAvatar` toolbar label under vertical bars. |
| Budget list   | Preserve year selection, annual recap, current-period semantics, creation and planning actions. Selection must use the future native container without the rejected card/stripe styling.                                                                                                |
| Budget detail | Sticky pager paints above the top safe area and compares global vertical geometry to the navigation bottom. Verify these assumptions when bars move to a vertical edge.                                                                                                                 |
| Shared hero   | `HeroZoneSurface` tracks the content zone against a top navigation boundary; verify pane-relative behavior before changing it.                                                                                                                                                          |
| Forms         | Reuse `SheetFormContainer`, amount fields and existing presentation. Verify focus, keyboard and unsaved values across genuine resize/fold transitions.                                                                                                                                  |

## Evidence still required

A verified Xcode 27.1+ environment must build Local and unsigned Prod and capture actual
SwiftUI home, annual budget, budget detail and entry forms across outer, inner portrait,
inner landscape, book and tabletop poses. Native captures must identify real chrome, fold, camera, scroll and keyboard defects
before Duo visual acceptance. Stabilized local captures may guide the standard native
container proposal while remote compilation proceeds. Legacy compilation or
resized images do not satisfy this gate.

## Remote prerequisite checkpoint

Local baseline builds pass, but Xcode 27.1 requires macOS 26.6 or later. The published
GitHub `xcode-27` image contains Xcode 27.1; CI selects it and downloads the matching
27.1 runtime explicitly. The existing unit/smoke job and all distribution authorization
gates remain in place. Actionlint's runner-label allowlist records the new hosted label.

The draft branch temporarily preserves an unsigned production archive after tests.
It accepts the tested PR merge tree only when identical to the source branch tree and
records both commits. This instrumentation must be removed after internal TestFlight
delivery. Local workflow lint and all 36 CI security tests pass. A checkpoint is required
to run the PR-only CI; it does not complete this phase or validate Duo rendering.

The first remote run, `39952873392`, verified Xcode 27.1 (`27A9275`), SDK 27.1 and
runtime 27.1 (`24A94425`). Its simulator creation failed before tests: this runtime's
`supportedDeviceTypes` contains only `com.apple.CoreSimulator.SimDeviceType.iPhone-Duo`.
The resolver now uses that observed type. No tests or archive from that failed run are
counted as passed. The public simctl help has no fold/pose control; native pose coverage
must remain explicit until Device Hub control is demonstrated.

## Local native captures (iOS 26.5)

The v2 XCTest result bundle is
`/private/tmp/pulpe-ios-duo-native-baseline-local-v2.xcresult`; its exported attachment
manifest is in the adjacent `-attachments` directory. Six screenshots show the actual
home, annual list and budget detail in portrait and landscape. These fixtures render
production tabs individually, without the enclosing `TabView`, so they do not prove
full app navigation or Duo behavior.

| Observed surface      | Native evidence                                                                                                       | Decision                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Home landscape        | White side bands; the light account avatar loses contrast outside the forest background.                              | Keep the forest content and fix width/background and semantic toolbar handling.                                      |
| Annual list landscape | The large annual summary pushes month rows below the first viewport; the trailing plus is clipped.                    | Native selection list with compact access to the existing annual summary and semantic toolbar actions.               |
| Detail landscape      | The hero uses most of the short viewport; the system search overlaps the visible filter area.                         | Inspect the real tab container and Duo bars before changing content geometry.                                        |
| Amount entry          | The keypad is present, but the hidden input has no accessible text-field focus; two elements announce only “Montant”. | Enter through real keypad keys; expose one amount control with its amount and currency, preserving focus activation. |

This run executed one test and failed at amount input, after the six captures. It is
not a passing continuity check. The next run must assert the exact amount through
rotation and preserve the disabled submission state for an incomplete draft.

Remote run `39956002261` successfully booted Duo on runtime 27.1, but the inherited
13-minute unit-step watchdog interrupted compilation before any test ran. Its preserved
`test-output.log` ends with `SwiftEmitModule` and `BUILD INTERRUPTED`, with no compiler
error or passing test. The cold-build budget is now 30 minutes inside a 75-minute job;
result checks and the post-test hang guard are unchanged. No Duo rendering is inferred
from this run.

## Navigation concurrency prerequisite

The first state increment coalesces pending deletion commits, keeps the latest requested
month, and ignores loading/error completion from an older month. Local focused testing
passed 30 tests in seven suites, including four deletion/navigation combinations and
two stale-load cases. Evidence:
`/private/tmp/pulpe-ios-duo-native-phase2a-tests-v1.xcresult` and its adjacent `.log`.
This validates state ordering, not the future split container or fold continuity.

The stabilized v3 UI run passed one test with zero failures and produced eight expected
captures in `/private/tmp/pulpe-ios-duo-native-baseline-local-v3.xcresult`. The amount
control reports exactly `12 CHF` after real keypad input and both rotations; the keyboard
remains present and incomplete submission remains disabled. Stable-frame polling still
shows the landscape width/toolbar defects above. The form amount is partly obscured by
the landscape keyboard: state continuity passes, complete visual reachability remains
open. An extra attachment named `failure` is a teardown naming mistake, not a failed
assertion; teardown now checks `totalFailureCount` instead of premature `hasSucceeded`.

Remote run `39960217562` compiled the SDK 27.1 simulator app and executed 2,490 tests
in 273 suites. Its only reported issue was the architecture line limit: the coordinator
has 350 newline characters, counted as 351 segments by the existing invariant. Smoke
captures and archive correctly remained gated. The independent review also found a
new-deletion undo-window regression in the first concurrency increment; that candidate
must not be distributed until the batch boundary is corrected and regression-tested.

## Shared fixes and adaptive presentation check

Deletion callbacks now confirm a snapshot of operation UUIDs; a previous toast cannot
consume a later deletion of the same entity. Navigation checks its generation before
starting another deletion batch, so returning to the current month preserves a later
undo window. The independent static review found no remaining issue in this increment;
the local `common-v4` run then passed 51 tests in eight suites, including the new
undo/navigation cases, root-entry locks, session resets and architecture invariants.
Evidence: `/private/tmp/pulpe-ios-duo-native-common-v4.xcresult` and its adjacent log.

The shared amount input keeps its real typographic height while transparent. Earlier
native form captures show the amount and underline fully above the keyboard in both
landscapes. The common `phase2b-ui-v1` captures also confirm that removing the home
container's fixed relative width restores the available landscape width, and that the
account action renders with the system button. These are iOS 26.5 observations.

The first native split-container run executed two UI tests: the cold budget-entry test
passed, while continuity failed. After entering `12` in landscape, rotating to portrait
closed the form entirely. The presentation host inside the adapting detail column is
the primary suspect. This is a real draft-preservation failure, not an amount-selector
failure; the split-container candidate remains unsuitable for distribution until a
stable presenter passes the unchanged rotation scenario. Evidence is in
`/private/tmp/pulpe-ios-duo-native-phase2b-ui-v1.xcresult` and its adjacent log and exported
attachments. No fold or inner-screen coverage is inferred from these rotations.

## Stable presentation candidate

The Budgets tab now owns the detail sheet presenter above the adaptive split view.
Each presentation carries its original coordinator, including nested budget entries;
the other tabs retain their existing local presenters and back stacks. The complete
unit target builds successfully and SwiftLint reports no violations in the 29 changed
Swift files. The final independent static review reports no actionable finding.

Local `phase2b-ui-v2` passes the cold month-entry regression. Its continuity scenario
preserves the chosen year through compact Back, switches from 2026 to January 2027
and back, and retains both `12 CHF` and `Repas test` through all three rotations with
the keyboard present. The final save-reachability assertion fails: XCTest reports the
button hittable while its frame remains below the viewport after keyboard dismissal.
The run is not green. The next candidate must scroll until the button is actually
inside the viewport and also exercise the sidebar's creation/planning sheets.
Evidence: `/private/tmp/pulpe-ios-duo-native-phase2b-ui-v2.xcresult` and adjacent log.

Version `1.11.0 (1)` is selected in the candidate after checking App Store Connect;
no build has been uploaded. The signed export and remote SDK 27.1 validation remain
required. These local rotations do not establish Duo fold or inner-display coverage.


## SDK 27.1 review disposition

Candidate `71ebac3a02c0efe45ed613e3732cf37eae095e47` retains an observable
`isNavigating`. The automated review proposed `@ObservationIgnored`, but independent
caller review rejects that change: `BudgetDetailsView` reads the property in
`.disabled(coordinator.isNavigating)`. It must invalidate the UI before an awaited
pending deletion and on cancellation/completion. Re-selecting the current month can
make clearing this flag the only observable mutation; ignoring it can leave stale
interaction state. The internal generation counters do not have this UI role.

Static review accepts the separate strict-orientation and current-geometry journeys
and the exact CI selector. Local regression passes both tests (240.074 seconds).
SDK 27.1 visual acceptance still requires the rail and horizontal title to be legible
simultaneously; no conclusion is inferred from a successful compile alone.

## Cold revisit lifecycle correction

Local instrumentation reproduces the SDK 27.1 failure on iOS 26.5. On the second
August entry, the SwiftUI task starts uncancelled, becomes cancelled during the
fixture fetch, and exits through the skeleton delay's cancellation catch without
restarting. The coordinator/projector store identities match. The task is now owned
by the existing view state, with appearance, disappearance and visible-month changes
controlling its lifetime. Coordinator identity, mutation generations, pending Undo
and store-owned tag refresh remain intact. Instrumentation is removed. Independent
review and the unchanged navigation journeys are the acceptance gate for this repair.

The first view-owned-task attempt is rejected by its unchanged current-geometry
journey: it still fails after the year round-trip. The strict rotation journey passes,
so neither that pass nor the lifecycle diagnosis proves the repair. Further isolation
checks the actual appearance/disappearance sequence and the transparent root `Group`.

## Detail navigation session boundary

A stable `ZStack` alone did not repair the native remount. Both experimental loading
changes are removed. `BudgetsTab` now creates its detail `NavigationStack` inside the
selected-budget branch. Returning to the list ends that stack; direct non-nil month
changes preserve its structural identity and coordinator. Independent review checked
all selection/path writers: deep links and creation select first; nested destinations
start from a selection; Back cannot clear it while a sheet or child path is active;
session reset closes those presentations before clearing selection. No normal route
requires an active Budgets child stack with no selected month.

The unchanged current-geometry journey passes (1 test, 0 failures, 121.481 seconds),
including the previously failing cold revisit and draft entry. The final strict
rotation and native Back run passes two tests in 242.149 seconds. Nested goal/spread
navigation passes in 26.731 seconds; the eight navigation/keyboard contracts also pass.
The eight local captures were inspected and refreshed without image edits. SDK 27.1
visual verification remains required before delivery.

Automated review of `75cfa5879` reports no blocking or important finding
([comment](https://github.com/neogenz/pulpe/pull/830#issuecomment-6371920868)).
Its suggestion to add feedback to the selection binding does not establish a defect:
month links are already disabled while root replacement is forbidden, and native
selection-clearing callbacks are intentionally rejected without user-facing noise.
The temporary archive steps remain scheduled for removal immediately after internal
delivery; no additional feature or approval action is implied by the review verdict.

## SDK 27.1 candidate 75cfa5879 outcome

The cold revisit is repaired in the actual Duo run. Native Back passes, and the
continuity journey reaches a preserved draft; its next failure comes from asking
XCTest whether the navigation-bar container has an activation point. Native title
and control frames, not container hittability or its broad bounding rectangle,
are the relevant collision geometry. The last recorded frame shows the amount and
description present above the keyboard; the subsequent AX frames were not exported.

The home title remains black on forest despite the visible native bar background.
This candidate is not visually accepted. The next candidate must retain the hero's
dark scheme together with the visible native vertical background, and prove both
title and control contrast in fresh screenshots. No archive or TestFlight upload
was produced from the failed run.

## Hero and native-control repair review

Independent static review accepts retaining the hero's dark bar scheme with a visible
native background in vertical context. It also accepts checking actual title/button
frames without activating their navigation-bar container. The same amount, description,
keyboard, viewport, geometry stability and action reachability checks remain in place.
No product form or loading behavior changed. The two local journeys pass (2 tests,
0 failures, 340.998 seconds); SDK 27.1 screenshots must still prove simultaneous title
and rail contrast. Neither local success nor static approval establishes that result.
