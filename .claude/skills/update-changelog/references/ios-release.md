# iOS Release

## Versioning

The app is **live on the App Store**. `MARKETING_VERSION` (currently `1.0.x`) tracks the iOS app's own SemVer, **independent** from the unified npm product version (`vX.Y.Z`). Do NOT map one onto the other.

- **Build number** (`CURRENT_PROJECT_VERSION`) — increments on **every** release that ships iOS changes. Always.
- **`MARKETING_VERSION`** — bump only when the release ships **user-facing iOS changes worth a new store version** (patch for fixes, minor for features). Releases that only touch web/backend leave it untouched.

The releaser decides build-only vs. marketing-bump per release. When unsure for a fix-only iOS release, a `build` bump is the safe default.

Resolve this decision before changelog data is written. A release with a marketing bump records that exact value as `iosVersion` in `landing/data/releases.json` and `backend-nest/src/modules/whats-new/releases-data.ts`. A build-only release records no `iosVersion` and cannot trigger the one-shot what's-new dialog because the bundle marketing version did not change.

## Curate iOS What's New

A marketing-version bump does not automatically deserve a dialog. The dialog is for changes that materially improve what an iOS user can do or remove friction they are likely to notice.

Include:

- A new iOS capability, workflow, or meaningful behavior.
- A visible UX improvement that makes a task clearer, faster, or easier.
- A fix for a frequent or core flow: access/login, data correctness, navigation, a crash, a blocked action, or repeated user frustration.

Exclude:

- Web-only or landing-only changes.
- Refactors, dependencies, telemetry, deployment, migrations, or implementation details.
- Minor security hardening with no user-visible change.
- Cosmetic micro-fixes and vague rollups such as "Stabilité iOS".
- Anything included only to avoid an empty dialog.

Keep at most 4 items. Write a concrete benefit-led title and one short sentence; omit platform suffixes such as `(iOS)` and technical vocabulary. If no item qualifies, leave `backend-nest/src/modules/whats-new/releases-data.ts` unchanged. A new iOS version without release data is valid and must show nothing.

## When to bump iOS

Bump iOS only when files under `ios/` are modified in the release. If only web or backend changed, iOS stays untouched.

## Apply version

**Build number only** (default for iOS fix-only releases, or web/backend releases that happened to touch `ios/`):

```bash
cd ios && ./scripts/bump-version.sh build
cd ios && xcodegen generate --use-cache
```

This increments `CURRENT_PROJECT_VERSION` (e.g. 1 -> 2) without touching `MARKETING_VERSION`.

**Marketing version** (new user-facing iOS store version) — confirm with the releaser first, then:

```bash
cd ios && ./scripts/bump-version.sh patch   # or minor
cd ios && xcodegen generate --use-cache
```

This bumps `MARKETING_VERSION` and resets/advances the build number. When you do this, also sync Railway `LATEST_IOS_VERSION` (see below).

## Files modified

After running the script, these files change:

- `ios/project.yml` — `CURRENT_PROJECT_VERSION`
- `ios/Pulpe.xcodeproj/project.pbxproj` — regenerated locally by XcodeGen and gitignored

Stage only `ios/project.yml`. Never stage the generated `.xcodeproj`.

## Sync Railway `LATEST_IOS_VERSION` (force-update gate)

When `MARKETING_VERSION` bumps (i.e. you used `set`, `major`, `minor`, or `patch` — NOT `build`), update `LATEST_IOS_VERSION` on Railway in **both** `preview` and `production` environments to match. The force-update endpoint (`GET /api/v1/app/version`) serves this value to clients; if it drifts, the soft-update prompt (follow-up) will lie.

Before updating Railway, verify the same version is present in the release's `iosVersion` field in both changelog copies. A mismatch means the release is not ready.

Use the Railway MCP `set-variables` tool — one call per environment:

```
mcp__Railway__set-variables
  workspacePath: <repo root>
  environment: preview     # then repeat with production
  service: backend
  skipDeploys: true        # vars take effect on next deploy anyway
  variables: ["LATEST_IOS_VERSION=<new MARKETING_VERSION>"]
```

> **Never** touch `MIN_IOS_VERSION` from this skill. That value is a deliberate kill switch — only bumped when a release contains a breaking change or critical fix that must force users off old binaries. Always require explicit user confirmation before changing it.

## No separate tag

No iOS-specific git tag is created. The only tag is the unified product tag `vX.Y.Z`.
