---
name: ios-build-test-env
description: iOS sim runtime is iOS 26.5 (not 26.2 as ios/CLAUDE.md examples say); xcodegen regen can corrupt DerivedData → nuke it to fix phantom build errors
metadata:
  type: reference
---

**Simulator OS:** installed runtime is **iOS 26.5** (`xcrun simctl list runtimes` → "iOS 26.5 (23F77)"), also iOS 18.5. The `ios/CLAUDE.md` examples hardcode `OS=26.2` which FAILS with "Unable to find a device matching the provided destination specifier". Use `OS=26.5`, or omit OS for plain `build` (only `test` needs the OS in the destination here). Device: `iPhone 17 Pro Max`. Always run `xcrun simctl list runtimes` to confirm before trusting a hardcoded OS.

**xcodegen + DerivedData corruption:** after `xcodegen generate --use-cache` adds new files, the first `xcodebuild build` can fail with phantom errors that are NOT in your code:
- `Build input file cannot be found: '.../posthog-ios/vendor/libwebp/yuv_sse41.c'` (the file exists on disk)
- `failed to deserialize Info.plist task context: No such file or directory`

These are stale build-graph artifacts. `xcodebuild clean` alone does NOT fix it. Fix: `trash ~/Library/Developer/Xcode/DerivedData/Pulpe-<hash>` then rebuild clean. Only build artifacts are lost; source + SPM checkouts in the repo are untouched. After nuke, build succeeded with zero real errors.

**Harmless test-run noise:** `[auth][STARTUP] Maintenance network error ... Code=-1004 Connexion au serveur impossible` appears at sim startup during `xcodebuild test` — the sim can't reach a backend. Ignore it; it is not a test failure.
