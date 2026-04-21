# JS/TS Release (Changesets — fixed mode)

Pulpe uses Changesets in **fixed mode**: all four npm sub-packages always bump together to the same version, mirroring the root `package.json`. There is no per-package version drift.

See `semver-conventions.md` for the rationale (Pulpe is a product, not a library).

## Source of truth

The **root `package.json`** holds the canonical product version. Bumping it is the FIRST thing the skill does in Step 6, before touching Changesets at all. Sub-package versions follow via fixed mode.

## Fixed group

`.changeset/config.json` declares the fixed group:

```json
"fixed": [
  ["pulpe-frontend", "pulpe-landing", "backend-nest", "pulpe-shared"]
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

This bumps **all four** sub-package `package.json` files to the same version, appends entries to per-package `CHANGELOG.md` files, and consumes the changeset file.

## Sanity check

After running `pnpm changeset version`, all five versions MUST match:

```bash
grep -H '"version"' package.json frontend/package.json landing/package.json backend-nest/package.json shared/package.json
```

If any version drifts, stop and investigate before committing — the fixed group is broken or the root bump didn't match the changeset bump level.

## Files modified

After running `pnpm changeset version`:
- `frontend/package.json`, `landing/package.json`, `backend-nest/package.json`, `shared/package.json` — all bumped to the new product version
- `frontend/CHANGELOG.md`, `landing/CHANGELOG.md`, `backend-nest/CHANGELOG.md`, `shared/CHANGELOG.md` — new entries appended (entries appear even for packages whose code didn't change — that's fixed mode, it's harmless)
- `.changeset/<name>.md` — consumed (deleted)

All must be staged in the release commit, alongside the manually-bumped root `package.json`.
