# Native baseline review

Evidence date: 2026-10-23. Phase 1 remains in progress; no Duo rendering is validated here.

## Source and toolchain

- Branch: `codex/ios-duo-native`, based on `origin/main` at `0e1b64afa587cd7794403883c01ac0458e0e545c`.
- Local Xcode: 26.6 (`17F113`); simulator SDK: 26.5; XcodeGen: 2.44.1.
- The local developer directory was selected per command, without changing the global setting.
- Installed simulator inventory has iOS 26.5 and older 18.x runtimes, with no iOS 27.1 or Duo device.
- The existing user simulator remains untouched. No fixture device has been booted for this baseline.

## Orientation prerequisite

`ios/project.yml` now declares portrait, landscape left and landscape right. Running
`xcodegen generate --use-cache` regenerated the same three orientations in
`ios/Pulpe/Resources/Info.plist`. iOS 18 deployment and iPhone device family 1 are unchanged.
No runtime orientation override was found in the iOS source.

| Check | Result |
| --- | --- |
| XcodeGen generation | Passed; second run reports unchanged cached project |
| Generated plist orientation parity | Passed: three expected orientations |
| Deployment/device target check | Passed: iOS 18 / iPhone |
| `git diff --check` | Passed |
| PulpeLocal generic simulator build | Passed: exit 0 and `BUILD SUCCEEDED`, SDK 26.5 |
| PulpeProd unsigned device build | Passed: exit 0 and `BUILD SUCCEEDED`, SDK 26.5, no signature |
| Duo screenshots and five-pose review | Not run; requires a verified SDK 27.1 runtime |

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

| Surface | Existing behavior to preserve or inspect |
| --- | --- |
| `MainTabView` | Four native tabs, independent typed stacks, shared budget destinations, foreign-keyboard inset handling. |
| Home | Preserve the current bounded mint `HomeHeroCard` surface documented in `ios/DESIGN.md`, its estimate and chart. Inspect the custom `ProfileAvatar` toolbar label under vertical bars. |
| Budget list | Preserve year selection, annual recap, current-period semantics, creation and planning actions. Selection must use the future native container without the rejected card/stripe styling. |
| Budget detail | Sticky pager paints above the top safe area and compares global vertical geometry to the navigation bottom. Verify these assumptions when bars move to a vertical edge. |
| Shared hero | `HeroZoneSurface` tracks the content zone against a top navigation boundary; verify pane-relative behavior before changing it. |
| Forms | Reuse `SheetFormContainer`, amount fields and existing presentation. Verify focus, keyboard and unsaved values across genuine resize/fold transitions. |

## Evidence still required

A verified Xcode 27.1+ environment must build Local and unsigned Prod and capture actual
SwiftUI home, annual budget, budget detail and entry forms across outer, inner portrait,
inner landscape, book and tabletop poses. Native captures must identify any real chrome,
fold, camera, scroll or keyboard defects before phase 2 begins. Legacy compilation or
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
