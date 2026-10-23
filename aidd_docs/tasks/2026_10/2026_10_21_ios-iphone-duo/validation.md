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
| Local native UI | 2 tests passed, 0 failures, 235.255 seconds on the dedicated iOS 26.5 simulator, including the new chart-width/viewport assertions. |
| Existing UI regressions | Four scenarios passed in the five-test run; the fifth passed on its targeted rerun after correcting the test activation target. |
| Independent static review | No actionable finding on the complete candidate, including the final fixture injection. |
| SDK 27.1 CI | App compiled; 2,497 tests / 273 suites executed with two contract failures. Corrections and another run are required. [Run](https://github.com/neogenz/pulpe/actions/runs/39975579885). |
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

Orientation changes are genuine simulator rotations. They do not establish which Duo
display is active or simulate a fold. The local machine runs Xcode 26.6 / SDK 26.5;
Xcode 27.1 requires a newer local macOS, so the matching SDK/runtime are tested in CI.
No global developer-directory change or OS upgrade was performed.

Actual inner-display, book/tabletop and multitasking resize remain manual Device Hub
checks until supported pose control is available. Public XCTest/simctl controls inspected
for this task do not expose a verified fold-angle operation. No resized image is presented
as evidence of another display or posture. The broader accessibility/legacy-device matrix
and physical-device review must be distinguished from the recorded tests above.
