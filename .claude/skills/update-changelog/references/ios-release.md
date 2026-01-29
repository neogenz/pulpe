# iOS Release

## Determine bump type

Map commits to bump:
- `feat!:` -> `major`
- `feat:` -> `minor`
- `fix:` -> `patch`

## Apply version

```bash
cd ios && ./scripts/bump-version.sh [major|minor|patch]
cd ios && xcodegen generate
```

## Create tag

```bash
git tag "ios@X.Y.Z" -m "Release iOS vX.Y.Z (build N)"
```
