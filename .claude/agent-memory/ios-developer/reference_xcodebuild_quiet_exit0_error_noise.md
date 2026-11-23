---
name: reference-xcodebuild-quiet-exit0-error-noise
description: xcodebuild -quiet on Xcode 27 prints "error: the following command failed with exit code 0 but produced no further output" lines on a SUCCESSFUL build; filter them before judging
metadata:
  type: reference
---

On Xcode 27 (seen 2026-11-22, `build-for-testing -scheme PulpeLocal -quiet`), the log carries ~20 lines
`error: the following command failed with exit code 0 but produced no further output` while xcodebuild
exits 0 and the products are built.

**How to apply:** save the output (`xcodebuild … > build.log 2>&1`), then judge the build by the exit code and by
`grep -v "failed with exit code 0 but produced no further output" build.log | grep error`, never by a raw
`grep error:`. For test counts, read the result bundle
(`xcrun xcresulttool get test-results summary --path X.xcresult --compact` → `totalTestCount`, and
`get test-results tests` for per-suite counts) since `-only-testing:` with Swift Testing can select zero.
