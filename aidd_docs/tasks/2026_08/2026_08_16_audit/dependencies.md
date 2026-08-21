# Codebase Audit: Android — dependencies

Expo's local compatibility check accepts the installed native package set, and the lockfile is pinned with integrity hashes. Registry audit still reports transitive issues in build/test tooling, while six direct packages appear unused.

- Date: 2026-08-16
- Scope: `android/package.json`, workspace lockfile, Expo compatibility and Android dependency paths
- Health: good
- Findings: 0 critical, 1 warning, 1 minor

## Findings

| Sev | Category     | Location                  | Issue                                                                                                                                                                                                                                                                    | Suggested fix                                                                                                                                            | Effort |
| --- | ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Dependencies | `android/package.json:29` | Android's Expo/Metro/Jest transitive graph contains 13 advisories (9 high, 4 moderate), including `ws`, `brace-expansion` and `image-size`. The observed paths are build/test tooling rather than app runtime, which limits exposure but leaves CI/developer input risk. | Upgrade through a compatible Expo SDK/toolchain release and regenerate the lockfile; do not force isolated transitive overrides without Expo validation. | M      |
| 🟢  | Dependencies | `android/package.json:21` | `@gorhom/bottom-sheet`, `d3`, `expo-auth-session`, `expo-blur`, `expo-device`, `expo-file-system` and `@types/d3` have no imports or app-plugin references.                                                                                                              | Remove the verified unused direct packages, then rerun Expo export and quality checks.                                                                   | S      |

## Top actions

1. Schedule the transitive advisory cleanup with the next compatible Expo patch/SDK update.
2. Remove the seven unused direct entries in one small dependency-only change.

## Coverage

- Scanned: production registry audit, Android dependency paths, lockfile versions/integrity, direct import/config usage and Expo's bundled native-module map.
- Verified: `expo install --check` reports dependencies up to date using its local compatibility map.
- Skipped: license inventory because the local pnpm package index is incomplete; latest online Expo compatibility metadata was unavailable in the offline check.
