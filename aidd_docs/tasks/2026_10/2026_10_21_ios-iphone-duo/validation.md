# Native adaptation validation

Version: `1.11.0 (1)`. Baseline source: `c06cc7c1a82164cf2bb785ec68260b29ef2691f4`;
the contract repairs below are part of the subsequent candidate on this branch.
Branch: `codex/ios-duo-native`; draft PR: <https://github.com/neogenz/pulpe/pull/830>.
Evidence date: 2026-10-23. Distribution is still pending.

## Implemented behavior

- Budgets uses the native selection list and `NavigationSplitView`; compact Back preserves the year, and the selected month stays synchronized with its detail.
- Detail sheets retain their originating coordinator above the adaptive columns. Open child editors and sheets prevent root replacement. Accueil and Objectifs preserve their own back stacks.
- Deletion confirmation drains operation UUIDs, preserving later undo windows and the latest navigation intent.
- The home fills its available landscape width; toolbar actions use semantic native labels. The existing amount field keeps enough real input height for the system keyboard to reveal it.
- Existing Pulpe surfaces, four tabs, formulas, currency handling and iOS 18 deployment remain in place.

## Evidence

| Check | Result |
| --- | --- |
| Local focused Swift Testing | 51 tests / 8 suites passed, including undo races, root-entry guards, reset and architecture invariants. |
| Contract repair units | 8 tests / 2 suites passed: keyboard-inset inventory and navigation ownership. |
| Complete unit-target compilation | Passed with SDK 26.5. |
| Commit quality hooks | Passed, including strict SwiftLint. |
| Local native UI | Latest repair run: 2 tests passed, 0 failures, 240.074 seconds on the dedicated iOS 26.5 simulator; actual Back plus strict three-orientation chart-width/viewport and draft assertions. |
| Existing UI regressions | Four scenarios passed in the five-test run; the fifth passed on its targeted rerun after correcting the test activation target. |
| Independent static review | No actionable finding on the complete candidate, including the final fixture injection. |
| SDK 27.1 CI | Candidate `71ebac3a`: 2,487 unit tests passed, 9 existing skips, no unit failure. The Back regression passed; current-geometry continuity failed on a cold month revisit. [Run](https://github.com/neogenz/pulpe/actions/runs/39988248570). |
| Signed export / TestFlight | Pending. |

The local UI journey opens a cold budget, changes year to January 2027 and returns to
2026, then keeps a `12 CHF` / `Repas test` draft through portrait and both landscapes.
The keyboard remains present and the amount avoids its frame. After keyboard dismissal,
the primary action is fully visible and enabled without submitting. Creation and planning
sheets retain a non-default template selection through the same rotations and close
without saving. Fixtures are synthetic.

Local result bundles are `/private/tmp/pulpe-ios-duo-native-common-v4.xcresult` and
`/private/tmp/pulpe-ios-duo-native-phase2b-ui-v3.xcresult`, with adjacent logs. The earlier
UI v1 lost its sheet and v2 failed its final scroll assertion; neither is counted as a
passing run. The stable presenter and viewport-aware scroll check resolve those observed
failures in v3.

The complementary local scenarios cover pointing/unpointing, home creation and budget
creation at accessibility text size, activity editing with Back to Accueil, and nested
goal/spread destinations. `/private/tmp/pulpe-ios-duo-native-regressions-v1.xcresult`
records four passes and one failure. Video shows the failed test activated the row's
contained pointing control rather than its opening area. The row component is unchanged
from `origin/main`. The corrected test taps the visible descriptive text and asserts the
detail root before retaining the original destination checks;
`/private/tmp/pulpe-ios-duo-native-route-v2b.xcresult` records one pass in 28.752 seconds.
Only test targeting changed; the app binary source remains the candidate above.

The SDK 27.1 run failed the old source-level assertion requiring
`containerRelativeFrame(.horizontal)` on the home and the missing keyboard-inset ruling
for the new `ContentUnavailableView`. The old source assertion is replaced by a real portrait-to-landscape width check,
including horizontal viewport containment in all three orientations. The field-free
placeholder explicitly refuses foreign keyboard insets and appears in the inventory.
The 8 related unit tests pass in `/private/tmp/pulpe-ios-duo-native-contracts-v1.xcresult`;
the enriched UI check passes in `/private/tmp/pulpe-ios-duo-native-contracts-ui-v1.xcresult`
(2 tests, 0 failures). Full SDK 27.1 CI still gates delivery. No build from the failed
candidate is eligible for distribution.

## SDK 27.1 follow-up

Candidate `a41f0ec9` resolves both earlier unit contracts: the result bundle records
2,496 total tests, 2,487 passed, 9 existing skips and no failures. Seven skips require
Keychain availability, one is the legacy biometric token-copy check under the same
condition, and one is the explicitly manual production PBKDF performance check.

Its UI run fails two assumptions. The native vertical rail exposes a hittable Back
button with an empty label, and `XCUIDevice.orientation` changes without the Duo
window rotating. The first test now checks actual Back navigation instead of its
label. The strict three-orientation journey remains available and runs locally;
CI selects an explicitly separate current-geometry journey, preserving the same
selection, draft, keyboard, viewport and navigation checks. It does not certify
rotation or fold transitions. [Apple documents](https://developer.apple.com/documentation/xcuiautomation/xcuidevice/orientation)
that physical and interface orientation are distinct; an independent
[XCTest reproduction](https://github.com/appium/appium/issues/22857) records this
Duo simulator behavior outside Appium's driver.

Actual 27.1 images also reveal pale rail controls on a light surface: the shared
hero navigation theme forced dark appearance beyond the forest background. The
candidate uses `toolbarVerticalEdge` to choose the screen appearance when controls
move into that rail. Acceptance requires a new 27.1 capture proving both rail and
horizontal title contrast; compilation alone is insufficient. The repaired Back and
strict rotation tests pass locally in
`/private/tmp/pulpe-ios-duo-native-v6-repair-ui-v1.xcresult` (2 tests, 0 failures). No archive from the
failed run was produced or distributed.

The next candidate, `71ebac3a`, compiles the vertical-edge API and again passes all
2,487 eligible unit tests. Its Back regression passes, and continuity reaches both
sidebar sheets and the year round-trip. Reopening August after January remains on a
skeleton with no error. The same current-geometry journey reproduces this failure on
local iOS 26.5 in 98.200 seconds; the restarted runner's subsequent zero-test summary
is not a pass. The fixture resolves both months immediately. Cache expiry (30 seconds)
and the detail load's cancellation/lifecycle are being isolated before a correction.
Evidence: `/private/tmp/pulpe-duo-ci-v7-native` and
`/private/tmp/pulpe-ios-duo-native-v7-current-geometry-v1.xcresult`.

Temporary local lifecycle traces establish the cancellation mechanism: the second
August entry starts with `Task.isCancelled == false`, then returns from the fixture
fetch with cancellation set about 43 ms later. The skeleton delay throws, the catch
runs, and no replacement load starts. Coordinator and projector reference the same
store and month; this is not an identity or fixture mismatch. The earlier successful
August and January entries appear in the same trace. Evidence:
`/private/tmp/pulpe-ios-duo-native-v7-lifecycle-diag-v2-system.log`.

The first repair retains the coordinator and owns only its loading task in view
state, starting on appearance or visible month change and cancelling on disappearance.
It is not accepted: the strict rotation journey passes in 217.998 seconds, but the
current-geometry journey still fails at the same cold revisit in 91.727 seconds.
Evidence: `/private/tmp/pulpe-ios-duo-native-v7-lifecycle-fix-ui-v1.xcresult`.
The appearance/disappearance callbacks and root container are being isolated. The
separate tag refresh already delegates to a store-owned task.

The owned-task trace then records `onAppear` and `onDisappear` for January's same
loading coordinator in the same millisecond, cancelling its task before execution.
A stable `ZStack` alone also fails the unchanged cold-revisit test (98.483 seconds).
Both attempts are removed. The final correction scopes the detail `NavigationStack`
to the selected-budget branch: compact Back destroys that navigation session; opening
a month creates a fresh one. Switching directly between two selected months keeps the
same branch, coordinator, pending Undo and generation protections. Nested destinations
remain inside the stack and the sheet presenter remains above the split container.

The unchanged current-geometry journey passes with this structural correction:
1 test, 0 failures, 121.481 seconds. Evidence:
`/private/tmp/pulpe-ios-duo-native-v7-detail-session-ui-v1.xcresult`.
The strict rotation journey and exact SDK 27.1 candidate still require validation.
No new loading property, detached task, cache rule or diagnostic logging remains.

The actual 27.1 home image confirms the rail's improved contrast but a black native
title on the forest surface. This candidate is not visually accepted. The next shared
bar change requests the native system background in vertical context while preserving
the existing horizontal hero behavior. It requires new 27.1 visual verification.
No archive or TestFlight upload was produced from this failed candidate.

## Native captures

These eight unmodified RGB PNGs come from the passing local UI run; the
[manifest](captures/ios-26-5/manifest.json) records their source, SHA-256, encoded
pixel dimensions and EXIF display orientation. They are validation evidence on iOS
26.5, not Duo listing assets. PNGs remain in the repository-designated local `evidence/`
directory, excluded from Git; the text manifest is tracked.

| Surface | Portrait | Landscape |
| --- | --- | --- |
| Home | [Capture](evidence/ios-26-5/home-portrait.png) | [Capture](evidence/ios-26-5/home-landscape.png) |
| Budgets | [Month list](evidence/ios-26-5/budgets-portrait.png) | [Native split](evidence/ios-26-5/budgets-split-landscape.png) |
| Entry draft | — | [Amount and keyboard](evidence/ios-26-5/draft-keyboard-landscape.png), [complete draft and submit](evidence/ios-26-5/draft-submit-landscape.png) |
| Sidebar sheets | — | [Create budget](evidence/ios-26-5/create-budget-landscape.png), [plan budgets](evidence/ios-26-5/plan-budgets-landscape.png) |

The local landscape detail retains a large hero above the ledger. Its rows require
scrolling; this capture does not prove the density of the wider Duo inner display.

## Coverage limits

Local iOS 26.5 orientation changes are genuine simulator rotations. The separate
Duo CI journey validates only its current geometry. Neither establishes all Duo
displays or simulates a fold. The local machine runs Xcode 26.6 / SDK 26.5;
Xcode 27.1 requires a newer local macOS, so the matching SDK/runtime are tested in CI.
No global developer-directory change or OS upgrade was performed.

Actual inner-display, book/tabletop and multitasking resize remain manual Device Hub
checks until supported pose control is available. Public XCTest/simctl controls inspected
for this task do not expose a verified fold-angle operation. No resized image is presented
as evidence of another display or posture. The broader accessibility/legacy-device matrix
and physical-device review must be distinguished from the recorded tests above.

## Manual checks on the internal beta

Use Device Hub's actual display and posture controls, or an iPhone Duo. Keep a
synthetic/test account for input scenarios. Orientation alone is not a substitute.

1. Open a budget on the outer display, open the device, rotate the inner display,
   then close it. Check the same month/year, one coherent Back path and reachable
   system controls at every transition.
2. In the book and tabletop positions, inspect the home chart, selected month,
   summary and ledger for clipping at the fold/camera region. Scroll to the last
   item and the creation action.
3. Start a forecast with an amount and description. Change posture with the keyboard
   open; check both values, focus and reachable save/cancel, then discard the draft.
   Repeat while a nested detail editor is open.
4. Open creation/planning, select a non-default template, then resize and rotate.
   Check the selection remains intact and close without saving.
5. Repeat the relevant journey with large text, hidden amounts and dark appearance.
   Check VoiceOver order, Reduce Motion/Transparency, background locking and an older
   supported iPhone separately; those combinations are not certified by this report.

These are recorded checks still to perform, not passing evidence.
