# JS/TS Release (Changesets)

Changesets is used to bump individual `package.json` versions of sub-packages. The product tag is handled separately at the root level.

## Apply versions

Do NOT run `pnpm changeset` interactively. Instead, create the changeset file directly:

```bash
# Generate a changeset file in .changeset/
# Filename: random-adjective-noun.md
```

Write the changeset file with this format:

```markdown
---
"package-name": minor
"other-package": patch
---

Description of changes in French (user-facing).
```

Then apply versions:

```bash
pnpm changeset version
```

This bumps the individual `package.json` versions and generates per-package `CHANGELOG.md` files.

**Note:** No per-package git tags are created. The only tag is the unified product tag `vX.Y.Z`.
