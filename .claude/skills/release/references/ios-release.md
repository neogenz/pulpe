# iOS Release

## Versioning

The app is **live on the App Store**. Read the current `MARKETING_VERSION` from `ios/project.yml`; it tracks the iOS app's own SemVer, **independent** from the unified npm product version (`vX.Y.Z`). Do NOT map one onto the other.

- **Build number** (`CURRENT_PROJECT_VERSION`) — must be higher than every build already uploaded for that marketing version. Internal TestFlight builds can advance the App Store Connect counter without modifying `project.yml`, so the repository value is not authoritative.
- **`MARKETING_VERSION`** — bump only when the release ships **user-facing iOS changes worth a new store version** (patch for fixes, minor for features). Releases that only touch web/backend leave it untouched.

The releaser decides build-only vs. marketing-bump per release. Propose `build` when the iOS changes are not user-facing, and include that decision in the release proposal for approval. When unsure for a fix-only iOS release, a `build` bump is the safe default.

Resolve this decision before changelog data is written. A release with a marketing bump records that exact value as `iosVersion` in `landing/data/releases.json`. It must then choose exactly one persistent backend mode: a curated entry in `RELEASES` when at least one item qualifies for the iOS dialog, or a motivated entry in `SILENT_IOS_RELEASES` when none qualifies. A build-only release records no `iosVersion` and cannot trigger the one-shot what's-new dialog because the bundle marketing version did not change.

| Mode         | iOS version           | Public changelog           | Persistent backend record                  |
| ------------ | --------------------- | -------------------------- | ------------------------------------------ |
| `projection` | Marketing bump        | Entry with `iosVersion`    | `RELEASES`: 1–4 curated items              |
| `silent`     | Marketing bump        | Entry with `iosVersion`    | `SILENT_IOS_RELEASES`: one concrete reason |
| `build`      | Build number only     | Entry without `iosVersion` | None                                       |
| `skip`       | Approved iOS decision | None                       | None                                       |

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

Before any iOS upload, query App Store Connect for the highest build number under the selected marketing version and choose the next unused integer. Never infer it only from `project.yml`.

**Build number only** (default for iOS fix-only releases, or web/backend releases that happened to touch `ios/`):

```bash
# Set CURRENT_PROJECT_VERSION in ios/project.yml to the ASC maximum + 1.
cd ios && xcodegen generate --use-cache
```

This sets `CURRENT_PROJECT_VERSION` to the exact build approved in the release proposal without touching `MARKETING_VERSION`. `./scripts/bump-version.sh build` is safe only when the repository value is already equal to the highest ASC build.

**Marketing version** (new user-facing iOS store version) — confirm with the releaser first, then:

```bash
cd ios && ./scripts/bump-version.sh patch   # or minor
cd ios && xcodegen generate --use-cache
```

This bumps `MARKETING_VERSION` and resets the build number to Pulpe's first-build convention, `1`. No Railway follow-up is owed — see the force-update gate section below.

## Files modified

After running the script, these files change:

- `ios/project.yml` — `CURRENT_PROJECT_VERSION`
- `ios/Pulpe.xcodeproj/project.pbxproj` — regenerated locally by XcodeGen and gitignored

Stage only `ios/project.yml`. Never stage the generated `.xcodeproj`.

## GitHub Actions distribution

- `internal`: manual dispatch from `main`, `PulpeProd` / `Prod`, next unused build under the selected marketing version. The existing staging-proof and upload-provenance checks remain; no App Review submission.
- `release`: called only by finalization after exact `production` and tag verification. The approved `ios/app-store-release.json` supplies version/build and copy. Archive/upload/submission is automatic, first-attempt-only and fresh-identity-only; an existing version/build or any ambiguous result stops for inspection. No automatic recovery or internal-build promotion.
- Signing secrets remain isolated in `ios-distribution`; an ephemeral keychain, imported profiles and all private files are cleaned under `always()`.
- Canonical setup, ordering, readbacks and failure handling: [Deployment](../../../../docs/DEPLOYMENT.md#release-process). Publication is `AFTER_APPROVAL`; Apple review is external.

## Force-update gate — nothing to sync

`LATEST_IOS_VERSION` is **not** a release chore. `IosVersionGateService`
(`backend-nest/src/modules/app-version/`) reads the version the App Store
actually serves and publishes it on `GET /api/v1/app/version`; the Railway
variable is only an offline fallback and a manual override. Never schedule,
apply, or report a pending `LATEST_IOS_VERSION` update, and never wait on App
Store availability before finishing the release.

Still verify the curated result matches the release:

- If an iOS projection exists, verify the same `iosVersion` is present in `landing/data/releases.json` and `backend-nest/src/modules/whats-new/domain/releases-data.ts`. A mismatch means the release is not ready.
- If no item qualified, verify `landing/data/releases.json` carries the new `iosVersion`, `SILENT_IOS_RELEASES` contains exactly one motivated entry for the product version, and no backend projection overlaps it. This intentional silence does not block the release.

> **Never** touch `MIN_IOS_VERSION` from this skill. That value is a deliberate kill switch — only bumped when a release contains a breaking change or critical fix that must force users off old binaries. Always require explicit user confirmation before changing it. The served floor is clamped to the version available on the App Store, so an early bump waits for Apple instead of blocking users on a binary they cannot download — that safety net is not a licence to set it without confirmation.

## No separate tag

No iOS-specific git tag is created. The only tag is the unified product tag `vX.Y.Z`.
