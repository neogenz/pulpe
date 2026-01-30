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

**Note:** No iOS-specific git tag is created. The only tag is the unified product tag `vX.Y.Z`.
