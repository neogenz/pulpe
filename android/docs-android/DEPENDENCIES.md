# Dependency security

Run `pnpm deps:check` after changing the Android dependency graph and
`pnpm audit` after refreshing the lockfile. Expo-compatible packages stay on the
versions reported by `expo install --check`; transitive fixes are accepted only
when their declared semver ranges allow them.

## Remaining advisory

Reviewed on 2026-08-22. npm advisory `1119441` affects `uuid@7.0.3` through:

```text
expo > @expo/config-plugins > xcode > uuid
```

The vulnerable v3/v5/v6 buffer API is part of the build-only Xcode project
parser and is neither called by Pulpe nor shipped in the Android runtime bundle.
The fixed `uuid >=11.1.1` is outside `xcode@3.0.1`'s supported major range, so a
workspace override would be unverified and is deliberately not used.

Remove this exception when the Expo SDK resolves `xcode` to a release using
`uuid >=11.1.1`. Recheck it on every Expo SDK or config-plugins update.
