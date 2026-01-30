# JS/TS Release (Changesets)

Changesets bumps individual `package.json` versions of affected sub-packages. The product tag is handled separately at the root level.

## Role of changesets

Changesets manages **internal package versions** (frontend, backend, shared, landing). These versions:
- Track what changed per package in local `CHANGELOG.md` files
- Are visible in `package.json` of each sub-package
- Do NOT generate git tags — only the product tag `vX.Y.Z` exists

## Apply versions

Do NOT run `pnpm changeset` interactively. Create the changeset file directly:

```markdown
---
"package-name": minor
"other-package": patch
---

Description of changes in French (user-facing).
```

Only include packages that were actually affected. Do not bump packages that had no changes.

Then apply:

```bash
pnpm changeset version
```

This bumps individual `package.json` versions and appends to per-package `CHANGELOG.md` files.

## Files modified

After running `pnpm changeset version`:
- `*/package.json` — version bumped for affected packages
- `*/CHANGELOG.md` — new entries appended
- `.changeset/` — changeset files consumed (deleted)

All must be staged in the release commit.
