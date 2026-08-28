# JS/TS Release (Changesets — fixed mode)

Pulpe uses Changesets in **fixed mode**: all five npm sub-packages always bump together to the same version, mirroring the root `package.json`. There is no per-package version drift.

See `semver-conventions.md` for the rationale (Pulpe is a product, not a library).

## Source of truth

The **root `package.json`** holds the canonical product version. Bumping it is the FIRST thing the skill does in Step 6, before touching Changesets at all. Sub-package versions follow via fixed mode.

## Fixed group

`.changeset/config.json` declares the fixed group:

```json
"fixed": [
  ["pulpe-frontend", "pulpe-landing", "backend-nest", "pulpe-shared", "pulpe-android"]
]
```

When `pnpm changeset version` runs, it bumps **every package in the group** to the same target version, regardless of which one was named in the changeset file. That target is computed from the highest bump level in any pending changeset.

**Practical implication:** the changeset file only needs to name **one** affected package and the desired bump level. Fixed mode handles the rest. Naming more packages doesn't add anything — but it also doesn't break anything, so it's fine to be explicit.

## Apply versions

Do NOT run `pnpm changeset` interactively. Create the changeset file directly:

```markdown
---
"pulpe-frontend": minor
---

Description of changes in French (user-facing).
```

The bump level (`major` / `minor` / `patch`) must match the level the skill computed in Step 4 from the root version. Naming `pulpe-frontend` is a convention — pick whichever package had the largest functional change, or `pulpe-frontend` by default if multiple packages changed.

Then apply:

```bash
pnpm changeset version
```

This bumps **all five** sub-package `package.json` files to the same version, appends entries to per-package `CHANGELOG.md` files, and consumes the changeset file. Because Android is private, `.changeset/config.json` explicitly enables private package versioning and disables private package tags.

## Sanity check

After running `pnpm changeset version`, copy the target into `android/app.json`. All seven product-version fields MUST match:

```bash
grep -H '"version"' package.json frontend/package.json landing/package.json backend-nest/package.json shared/package.json android/package.json android/app.json
```

If any version drifts, stop and investigate before committing — the fixed group is broken or the root bump didn't match the changeset bump level.

## Files modified

After running `pnpm changeset version`:

- `frontend/package.json`, `landing/package.json`, `backend-nest/package.json`, `shared/package.json`, `android/package.json` — all bumped to the new product version
- `frontend/CHANGELOG.md`, `landing/CHANGELOG.md`, `backend-nest/CHANGELOG.md`, `shared/CHANGELOG.md`, `android/CHANGELOG.md` — new entries appended (entries appear even for packages whose code didn't change — that's fixed mode, it's harmless)
- `android/app.json` — synchronized explicitly from the approved product version after Changesets
- `.changeset/<name>.md` — consumed (deleted)

All must be staged in the release commit, alongside the manually-bumped root `package.json`.

## Artifact-derived web version

The backend embeds `backend-nest/package.json` in its build artifact and serves that
version as `web.latestVersion`; no Railway variable is synchronized during release.

Promotion is two-staged: the manual `🚦 Release Promotion` entry runs a read-only
`plan` job today, and the apply path is **activated at the phase-9 cutover** — GitHub
`production` environment protection first, then the protected job calling the
reusable `production.yml` in phase 9's own preparation PR, never a temporary flag.
Once active, that preflight proves the exact frontend SHA is public, publishes its
immutable context, and finishes; Railway `Wait for CI` then deploys `main` as the
sole backend deployment owner. `production-finalize.yml` verifies the exact active
Railway SHA and the public `GET /api/v1/app/version` payload before publishing the
tag and GitHub Release. A contradictory provider state fails closed; operators must
not substitute a local variable write or redeploy.

> **Never** touch `MIN_WEB_VERSION` from this skill. That value is a deliberate kill switch — only bumped when a release contains a breaking change or critical fix that must force users off old binaries. Always require explicit user confirmation before changing it.
