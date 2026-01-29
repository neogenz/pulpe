# JS/TS Release (Changesets)

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

## Create tags

For each bumped JS/TS package:

```bash
git tag "pulpe-frontend@X.Y.Z" -m "Release pulpe-frontend vX.Y.Z"
git tag "backend-nest@X.Y.Z" -m "Release backend-nest vX.Y.Z"
git tag "pulpe-shared@X.Y.Z" -m "Release pulpe-shared vX.Y.Z"
```

Only create tags for packages that were actually bumped.
