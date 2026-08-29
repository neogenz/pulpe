---
status: done
---

# Instruction: Toolchain and dependency alignment

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── pnpm-lock.yaml                          ✏️ regenerated
└── android
    ├── package.json                        ✏️ SDK 57 patch levels, react-dom placement, zod pinned to the shared copy, react-query and posthog minors
    └── docs-android
        └── DEPENDENCIES.md                 ✏️ react-dom and zod decisions, review date 2026-08-27
```

## User Journey

```mermaid
flowchart TD
  A["Developer runs pnpm deps:check"] --> B{expo install --check}
  B -->|14 packages behind| C["expo install --fix"]
  C --> D["pnpm install, lockfile regenerated"]
  D --> E["pnpm deps:check exits 0"]
  E --> F["Dev client rebuilt, smoke flow green"]
  F --> G["DEPENDENCIES.md records react-dom and zod"]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Clean worktree on the feature branch with node_modules installed => baseline: 5: cli
  section Happy path
    Run expo install --fix then pnpm install => lockfile updated, no peer warnings from expo => pnpm deps:check exits 0: 5: cli
    Run pnpm --filter pulpe-android quality and test => type-check, lint, format and 740 tests green: 5: cli
    Rebuild the debug APK and run maestro smoke.yaml on the emulator => flow passes: 5: cli
  section Edge case - react-dom removal breaks expo-doctor
    expo-doctor or expo install --check complains after moving react-dom => keep it as a runtime dependency => decision recorded in DEPENDENCIES.md: 3: cli
  section Edge case - two zod copies
    pnpm why zod shows a second resolved version under pulpe-android => pin android to the shared copy => one zod in the lockfile: 3: cli
```

## Tasks to do

### `1)` Align the Expo-governed packages

> `expo install --check` is green again.

1. `cd android && pnpm exec expo install --fix`, then `pnpm install` from the root.
2. `pnpm deps:check` must exit 0; `pnpm audit` must show no advisory with a `pulpe-android` path.

### `2)` Settle `react-dom`

> Runtime dependencies carry only what the APK needs.

1. `pnpm why react-dom --filter pulpe-android`; if only `expo`/`expo-router` web peers pull it, move it to `devDependencies`.
2. If `expo-doctor` or `expo install --check` objects, keep it and write why in `DEPENDENCIES.md`.

### `3)` One zod copy

> Android bundles the same zod as `pulpe-shared`.

1. `pnpm why zod --filter pulpe-android` and `--filter pulpe-shared`; pin `android/package.json` to the version resolved for shared.
2. Ranges in `shared`, `frontend` and `backend-nest` are not touched.

### `4)` Minor bumps outside Expo's list

> `@tanstack/react-query` and `posthog-react-native` sit on their latest minor.

1. Bump both, run `pnpm --filter pulpe-android test`.

### `5)` Prove the binary

> The dev client still boots and the smoke flow still passes.

1. `pnpm --filter pulpe-android native:generate`, then `cd android/android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`.
2. Install on the emulator, `maestro test android/maestro/smoke.yaml`.
3. Update the review date and the two decisions in `docs-android/DEPENDENCIES.md`; list the majors held back by peers (`eslint` 10, `@types/jest` 30, `@babel/runtime` 8) with the blocking peer for each.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm deps:check` exits 0; `pnpm audit` reports no advisory reaching `pulpe-android`.                                         |
| 2    | `react-dom` is either a devDependency with `expo-doctor` green, or a runtime dependency with its reason in `DEPENDENCIES.md`. |
| 3    | `pnpm why zod` shows one resolved zod version for `pulpe-android` and `pulpe-shared`.                                         |
| 4    | `pnpm --filter pulpe-android test` is green on the bumped versions.                                                           |
| 5    | The debug APK installs, `smoke.yaml` passes, `DEPENDENCIES.md` carries the 2026-08-27 review.                                 |
