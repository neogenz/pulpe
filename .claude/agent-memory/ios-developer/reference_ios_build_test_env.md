---
name: ios-build-cache-recovery
description: Recognize stale Xcode build-graph failures after project regeneration and recover without deleting source or dependency checkouts
metadata:
  type: reference
---

# Xcode build cache recovery

After `xcodegen generate --use-cache` adds or removes files, the first build can fail with stale
build-graph errors even though the referenced files exist. Two observed signatures are:

- `Build input file cannot be found` for a dependency file that exists on disk;
- `failed to deserialize Info.plist task context: No such file or directory`.

Confirm that the referenced file exists and that no real compiler error precedes the message.
`xcodebuild clean` may not clear this state. Resolve the exact
`~/Library/Developer/Xcode/DerivedData/Pulpe-<hash>` directory, move only that directory to the
Trash, then rebuild. Do not delete all DerivedData, repository sources, or Swift Package Manager
checkouts.
