# Native adaptation validation

Native adjustments are implemented and the verified build is available in internal TestFlight.
The complete Duo qualification matrix remains partial.
Version: `1.11.0 (1)`; delivered source: `d93e69614e4bf795c6cd020e5e466edeaef1010c`.
Branch: `codex/ios-duo-native`; [PR #830](https://github.com/neogenz/pulpe/pull/830).
Recorded on 2026-10-24 (Europe/Zurich). Product code matches the visually accepted
`43405c5b`; the subsequent commit changes only one test query and reports.

## Behavior covered

- Budgets uses `NavigationSplitView` and native selection. Compact Back preserves the chosen year; month selection and detail remain synchronized.
- Detail sheets keep their originating coordinator above the adaptive columns, including nested budget entries. An open editor or sheet prevents root replacement.
- Confirmed deletions use operation identities; later undo windows and the latest month-selection intent remain protected.
- Returning to the list ends the detail navigation session. Reopening a month loads a fresh session without replacing a coordinator during direct month changes.
- Home expands to the available landscape width. Semantic toolbar actions and the existing amount input preserve native navigation and keyboard behavior.
- Six screen/skeleton heroes extend only their backgrounds horizontally; embedded annual summaries retain their previous scope.
- Four tabs, formulas, currency rules, iOS 18 deployment and existing service behavior remain unchanged.

## Recorded validation

| Evidence | Result and scope |
| --- | --- |
| Earlier shared-logic regression run | 51 tests / 8 suites passed: undo/navigation races, root-entry guards, resets and architecture invariants. This is an earlier checkpoint, not a rerun of every test on the final candidate. |
| Current hero contracts, v12 | 20 tests / 2 suites passed in 0.037 s: `HeroContrastTests` and `HomeHeroCardTests`; `TEST SUCCEEDED`, exit 0. |
| Current strict native journey, v12 | 1 test, 0 failures, 326.401 s; `TEST SUCCEEDED`, exit 0. Real portrait, landscape-left and landscape-right transitions on iOS 26.5. |
| Corrected local current-geometry journey | 1 test / 0 failures, 161.620 s, `TEST SUCCEEDED`, exit 0. Only the close-button query changed; all five native controls remain required. |
| Static quality | Mandatory commit quality and SwiftLint passed, with no correction. |
| SDK 27.1 units | 2,487 passed, nine existing skips, zero failures; 2,783 executions including parameters. |
| SDK 27.1 UI | 2 passed / 0 failures, 267.379 s: native Back 35.947 s and current-geometry continuity 231.432 s. |
| Visual inspection, v12 | Complete goal pencil on uniform forest/disc in both landscapes; native sidebar remains a distinct light panel. Annual list without detail retains its white canvas. |

The 51 earlier tests and 20 current tests have different scopes and checkpoints; they are
not a claim that 71 tests were rerun against this candidate. Older navigation/keyboard
contracts and nested-route regressions remain supporting evidence in the retained artifacts.

The strict journey covers cold budget entry, compact Back, a January 2027/2026 round-trip,
linked goal navigation, and creation/planning sheets retaining a non-default template.
A `12 CHF` / `Repas test` draft survives all three orientations and keyboard focus changes.
The amount stays inside the viewport and outside the keyboard; visible amount content
avoids the required native controls. After keyboard dismissal, Ajouter is visible and
enabled. The scenario does not submit data; fixtures are synthetic.

Evidence bundles and adjacent logs:
- `/private/tmp/pulpe-ios-duo-native-common-v4.xcresult` — earlier 51-test checkpoint.
- `/private/tmp/pulpe-ios-duo-native-v12-hero-contracts.xcresult` — current 20 tests.
- `/private/tmp/pulpe-ios-duo-native-v12-ui.xcresult` — strict journey.
- `/private/tmp/pulpe-ios-duo-native-v12-ui-attachments/manifest.json` — unmodified native captures.

## SDK 27.1 evidence

[CI 40031998038](https://github.com/neogenz/pulpe/actions/runs/40031998038) uses
Xcode 27.1 (27A9275) and iOS 27.1 (24A94425). The corrected journey completes:
`12 CHF`, `Repas test`, restored amount focus and the reachable submit action.
Independent review accepts the native title, rail, tabs, goal action and final draft.
Measured control samples are recorded in [native-review.md](native-review.md).

The [Duo capture manifest](captures/ios-27-1/manifest.json) records 13 unmodified RGB
PNGs at 1398 × 2034, their hashes and source. Images remain locally in the ignored
`evidence/ios-27-1/` directory. These are native validation captures with synthetic data,
not a complete set of App Store assets; no inner-display image was fabricated.

- [Home](evidence/ios-27-1/home-current-geometry.png), [annual list](evidence/ios-27-1/annual-budget-current-geometry.png), [budget](evidence/ios-27-1/budget-detail-current-geometry.png), [goal](evidence/ios-27-1/savings-goal-current-geometry.png).
- [Amount with keyboard](evidence/ios-27-1/entry-draft-current-geometry.png), [restored draft](evidence/ios-27-1/entry-draft-restored-current-geometry.png), [reachable submit](evidence/ios-27-1/entry-draft-submit.png).

Result bundles: `/private/tmp/pulpe-duo-ci-v11-native/{TestResults,DuoResults}.xcresult`.
The earlier local [manifest](captures/ios-26-5/manifest.json) identifies its own checkpoint;
the current local v12 evidence above supersedes it for the horizontal goal repair.

## Internal TestFlight delivery

The complete CI is green. The Prod archive records source `d93e69614`, tested merge
`beb25b58610bd48dc3bcdd66f6cdaf585277208e`, and matching tree
`9f839bfa2e2bffe668fb8801123752cc33dbf626`. App and widget are 1.11.0 (1), built
with SDK 27.1 (24A94232), minimum iOS 18. The original archive and tar remain intact.

The unsigned archive omitted capability entitlements. A temporary copy received
intermediate ad hoc signatures with the two exact source entitlement files; Xcode 26.6
then performed the standard App Store Connect export and all final distribution signing.
This intermediate preparation is not presented as an officially supported Apple workflow.
No final IPA patch, manual distribution signature or older-SDK rebuild was used.

Three native signatures verify outside the sandbox and their actual certificates match
`EA0D02252873E7AC47380D51D0ED6DE2C39280D5`. Final app/widget entitlements equal the
source capabilities plus the four expected distribution keys: exact App Group, Apple Sign In
and concrete associated domain, correct application/team identifiers, beta reports and no
debug access. Embedded profiles are byte-identical to the validated profiles and authorize
every claimed entitlement. An independent parent check agrees.

Original archive → prepared copy → final IPA preserves all three UUIDs, code-section
hashes, SDK/load commands and dependencies; dSYMs and bundle metadata match. No runtime
or SwiftSupport was added. The final IPA SHA-256 is
`e597a3a447078e6c159c4be9b85f6bc4e27daafd514d3da7aef03a509923abe5`.
Receipts are in `/private/tmp/pulpe-duo-testflight/export-v11-prepared/`:
`parent-verification.json`, `native-signature-verification.json` and
`code-provenance-verification.json`. Original provenance remains in
`/private/tmp/pulpe-duo-ci-v11-archive/`.

Readback at 2026-10-23 23:13:03 UTC confirms:

| Delivery field | Verified value |
| --- | --- |
| App / build | `6758464920` / `73c0f535-66b2-4cc9-a52f-5b92ec77e45f` |
| Version | `1.11.0 (1)` |
| Processing / audience / availability | `VALID` / `INTERNAL_ONLY` / `IN_BETA_TESTING` |
| Effective group | `Moi` (`4d65bf0b-0684-4de2-a324-96ff78579eeb`), with all-build access |
| French notes | `fr-FR`, read back unchanged except the terminal newline |
| Uploads / App Review submissions | One / none |

The delivery receipt is `testflight-delivery-receipt.json` beside the signature receipts.
No explicit tester notification was requested; Apple's existing automatic-notification
setting is enabled. The two temporary archive CI steps have been removed. The delivered
source remains `d93e69614`; later documentation/CI cleanup does not change any `ios/` file.
The native CI regression and capture steps remain in place.

## Coverage limits

Local SDK 26.5 proves genuine classic-device rotations, not Duo display/fold transitions.
The separate Duo journey targets current geometry explicitly; physical orientation alone
is not evidence that its scene resized. The SDK 27.1 vertical mask is accepted on the captured outer geometry; its horizontal
path still lacks direct SDK 27.1 evidence. Outer, inner portrait, inner landscape, book and
tabletop poses, folds, camera clearance and multitasking resize are not certified.
Home pending-items captures do not prove manual panning or shortcut activation when the
row was already visible. The short budget fixture does not prove the sticky pager appeared.
The 4.675:1 accepted pencil/disc sample does not certify Back, status-bar or other controls.
VoiceOver, broader Dynamic Type/appearance combinations, Reduce Motion/Transparency,
physical devices and the full older-device matrix remain outside the recorded acceptance.
