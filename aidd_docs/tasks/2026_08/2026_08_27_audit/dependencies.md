# Codebase Audit: android/ (dependencies)

No vulnerability reaches the app. The SDK 57 patch set drifted by one release and turns `pnpm deps:check` red; the rest is routine minor drift.

- **Date**: 2026-08-27
- **Scope**: `android/package.json` (pnpm workspace member `pulpe-android`)
- **Health**: fair
- **Findings**: 0 critical, 1 warning, 3 minor

## Findings

| Sev | Category     | Location                                                                                                                                                                                                                                                                                                       | Issue                                                                                                                                                                                   | Suggested fix                                                                                                | Effort |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 🟡  | dependencies | `android/package.json` (`expo` 57.0.16 → ~57.0.17, `react-native` 0.86.2 → 0.86.3, `expo-router`, `expo-updates`, `expo-secure-store`, `expo-notifications`, `expo-dev-client`, `expo-constants`, `expo-linking`, `expo-haptics`, `expo-system-ui`, `@expo/metro-runtime`, `eslint-config-expo`, `jest-expo`)  | `expo install --check` lists 14 packages one patch behind the SDK 57 set, so the root `pnpm deps:check` exits 1. The drift touches the router and secure store, both on the vault path. | `pnpm --dir android exec expo install --fix`, rebuild the dev client, rerun Jest and the Maestro smoke flow. | S      |
| 🟢  | dependencies | `android/package.json` (`@shopify/react-native-skia` 2.6.2 → 2.11.1, `react-native-reanimated` 4.5.1 → 4.6.0, `react-native-safe-area-context` 5.7.0 → 5.9.1, `react-native-screens` 4.26.2 → 4.27.0, `@tanstack/react-query` 5.101.4 → 5.102.8, `posthog-react-native` 4.63.5 → 4.66.0, `zod` 4.1.13 → 4.4.3) | Minor drift. Skia is five minors behind and native (new dev build). `zod` must move in lockstep with `shared/` (CLAUDE.md: remeasure the Angular bundle after a Zod upgrade).           | One "deps" PR after the SDK patch fix; `zod` together with `shared/` and `frontend/`.                        | M      |
| 🟢  | dependencies | `android/package.json:55`                                                                                                                                                                                                                                                                                      | `react-dom` 19.2.3 is a runtime dependency while the app has no web platform (`app.json` declares none, no `react-native-web`).                                                         | `pnpm why react-dom`; remove it or move it to `devDependencies` if `jest-expo` pulls it.                     | S      |
| 🟢  | dependencies | `android/package.json` (dev: `eslint` 9.39.5 → 10.9.1, `@types/jest` 29.5.14 → 30.0.0, `@babel/runtime` 7.29.7 → 8.0.0)                                                                                                                                                                                        | Majors pending. Jest stays on 29 because `jest-expo` 57 pins it (project memory), so `@types/jest` 30 has to wait; `eslint` 10 waits for `eslint-config-expo`.                          | Leave until `jest-expo` and `eslint-config-expo` move; revisit at SDK 58.                                    | S      |

Verified (no row): `pnpm audit --json` reports 98 advisories workspace-wide (7 low, 46 moderate, 45 high) and 0 whose dependency path starts with `pulpe-android`; they all live under `backend-nest` and toolchain paths. Supply chain: GitHub Actions SHA-pinned, Maestro download sha256-checked, EAS workflows pinned to SDK 57 images.

## Top actions

1. `expo install --fix` and get `pnpm deps:check` green again (row 1).
2. Batch the minor bumps, `zod` in lockstep with `shared/` (row 2).
3. Drop or demote `react-dom` (row 3).

## Coverage

- **Scanned**: dependencies (`pnpm audit --json` filtered on `pulpe-android` paths, `pnpm --filter pulpe-android outdated`, `pnpm deps:check:expo`, unused-dependency review of `package.json`, workflow pinning)
- **Skipped**: license inventory (`pnpm licenses list --filter pulpe-android` returned nothing in this workspace; no per-package license scan was run)
