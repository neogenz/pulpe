# Dependency security

Run `pnpm deps:check` after changing the Android dependency graph and
`pnpm audit` after refreshing the lockfile. Expo-compatible packages stay on the
versions reported by `expo install --check`; transitive fixes are accepted only
when their declared semver ranges allow them.

Reviewed on 2026-08-27: `expo install --fix` aligned the SDK 57 patch levels,
`expo-doctor` passes 21/21, `pnpm deps:check` exits 0.

## Placement decisions

- `react-dom` is a devDependency. Nothing in the APK imports it: the only
  consumers are the web peers of `expo-router` (`@expo/ui` → `vaul` →
  `@radix-ui/*`), and `expo-doctor` is green with it out of the runtime list.
  Keeping it installed silences the peer warning without shipping it.
- `zod` is pinned to the exact version `pulpe-shared` resolves (`4.1.13`) so
  the bundle carries one copy. The `zod@3` under `@expo/cli` is a build tool
  and never reaches the bundle. Ranges in `shared`, `frontend` and
  `backend-nest` are not this package's to move: a range change there needs
  the Angular bundle re-measure (`CLAUDE.md`).

## Majors held back by peers

| Package          | Latest | Kept on | Blocking peer                                                                                |
| ---------------- | ------ | ------- | -------------------------------------------------------------------------------------------- |
| `eslint`         | 10     | 9       | `eslint-plugin-import` (`^9`) and `eslint-plugin-react` (`^9.7`) via `eslint-config-expo@57` |
| `@types/jest`    | 30     | 29      | `jest-expo@57` runs `jest@29` (`@jest/globals ^29`)                                          |
| `@babel/runtime` | 8      | 7       | `babel-preset-expo@57` peer `^7.20.0`                                                        |

Recheck the three on the next Expo SDK upgrade; they move when
`eslint-config-expo`, `jest-expo` and `babel-preset-expo` do.

## Remaining advisory

Reviewed on 2026-08-27. npm advisory `1119441` affects `uuid@7.0.3` through:

```text
expo > @expo/config-plugins > xcode > uuid
```

The vulnerable v3/v5/v6 buffer API is part of the build-only Xcode project
parser and is neither called by Pulpe nor shipped in the Android runtime bundle.
The fixed `uuid >=11.1.1` is outside `xcode@3.0.1`'s supported major range, so a
workspace override would be unverified and is deliberately not used.

Remove this exception when the Expo SDK resolves `xcode` to a release using
`uuid >=11.1.1`. Recheck it on every Expo SDK or config-plugins update.
