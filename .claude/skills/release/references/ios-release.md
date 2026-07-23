# iOS Release

## Versioning

The app is **live on the App Store**. Read the current `MARKETING_VERSION` from `ios/project.yml`; it tracks the iOS app's own SemVer, **independent** from the unified npm product version (`vX.Y.Z`). Do NOT map one onto the other.

- **Build number** (`CURRENT_PROJECT_VERSION`) — increments on **every** release that ships iOS changes. Always.
- **`MARKETING_VERSION`** — bump only when the release ships **user-facing iOS changes worth a new store version** (patch for fixes, minor for features). Releases that only touch web/backend leave it untouched.

The releaser decides build-only vs. marketing-bump per release. Propose `build` when the iOS changes are not user-facing, and include that decision in the release proposal for approval. When unsure for a fix-only iOS release, a `build` bump is the safe default.

Resolve this decision before changelog data is written. A release with a marketing bump records that exact value as `iosVersion` in `landing/data/releases.json`. It must then choose exactly one persistent backend mode: a curated entry in `RELEASES` when at least one item qualifies for the iOS dialog, or a motivated entry in `SILENT_IOS_RELEASES` when none qualifies. A build-only release records no `iosVersion` and cannot trigger the one-shot what's-new dialog because the bundle marketing version did not change.

| Mode         | iOS version           | Public changelog           | Persistent backend record                 |
| ------------ | --------------------- | -------------------------- | ----------------------------------------- |
| `projection` | Marketing bump        | Entry with `iosVersion`    | `RELEASES`: 1–4 curated items             |
| `silent`     | Marketing bump        | Entry with `iosVersion`    | `SILENT_IOS_RELEASES`: one concrete reason |
| `build`      | Build number only     | Entry without `iosVersion` | None                                      |
| `skip`       | Approved iOS decision | None                       | None                                      |

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

Keep at most 4 items. Write a concrete benefit-led title and one short sentence; omit platform suffixes such as `(iOS)` and technical vocabulary. If no item qualifies, add the product version and a concrete curation reason to `SILENT_IOS_RELEASES` instead of adding a projection. The registry is the explicit release record; it does not make the app show a dialog.

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

This bumps `MARKETING_VERSION` and resets/advances the build number. Schedule the Railway `LATEST_IOS_VERSION` sync described below, but do not apply it before that version is publicly available on the App Store.

## Files modified

After running the script, these files change:

- `ios/project.yml` — `CURRENT_PROJECT_VERSION`
- `ios/Pulpe.xcodeproj/project.pbxproj` — regenerated locally by XcodeGen and gitignored

Stage only `ios/project.yml`. Never stage the generated `.xcodeproj`.

## Sync Railway `LATEST_IOS_VERSION` (force-update gate)

When `MARKETING_VERSION` bumps (i.e. you used `set`, `major`, `minor`, or `patch` — NOT `build`), record a pending `LATEST_IOS_VERSION` update for Railway in **both** `preview` and `production`. Apply it only after App Store Connect confirms that this marketing version is publicly available. Git publication and TestFlight availability are not sufficient.

If the App Store release is still pending when Step 9 finishes, leave both values unchanged and report one deferred post-App-Store operation. The force-update endpoint (`GET /api/v1/app/version`) serves this value to clients; changing it early would advertise a binary users cannot download.

Before updating Railway, apply the branch that matches the curated result:

- If an iOS projection exists, verify the same `iosVersion` is present in `landing/data/releases.json` and `backend-nest/src/modules/whats-new/domain/releases-data.ts`. A mismatch means the release is not ready.
- If no item qualified, verify `landing/data/releases.json` carries the new `iosVersion`, `SILENT_IOS_RELEASES` contains exactly one motivated entry for the product version, and no backend projection overlaps it. This intentional silence does not block the Railway update or the release.

Use the Railway integration available to the current agent — one operation per environment with these semantics:

```
workspace: <repo root>
environment: preview, then production
service: backend
skip deploy: false
variable: LATEST_IOS_VERSION=<new MARKETING_VERSION>
```

Before applying the deferred update, verify App Store availability again. The variable change must redeploy the backend so the running `ConfigService` reads the new value; wait for the resulting deployment to succeed in each environment. If no Railway integration is available, report the missing capability and leave the gate unchanged. Never omit the update silently or guess an unsupported CLI/MCP command. After both environment updates, verify the public version endpoint reports the new iOS marketing version.

> **Never** touch `MIN_IOS_VERSION` from this skill. That value is a deliberate kill switch — only bumped when a release contains a breaking change or critical fix that must force users off old binaries. Always require explicit user confirmation before changing it.

## No separate tag

No iOS-specific git tag is created. The only tag is the unified product tag `vX.Y.Z`.
