---
status: in-progress
---

# Instruction: Clean dependencies and automate smoke QA

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
pnpm-lock.yaml ✏️
android/
├── .eas/workflows/deploy-preview.yml ✏️
├── README.md ✏️
├── app.json ✏️
├── docs-android/RELEASE.md ✏️
├── maestro/
│   ├── login-vault.yaml ✏️
│   └── smoke.yaml ✅
└── package.json ✏️
```

## User Journey

```mermaid
flowchart TD
  A[Relevant pull request] --> B[EAS builds the preview APK]
  B --> C[Maestro starts the Android emulator]
  C --> D[Login and vault flow runs]
  D --> E[Point and undo flow runs]
  E --> F[Pull request receives a pass or actionable failure]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    EAS project and deterministic preview fixture exist => protected credentials are available: 5: system
  section Happy path
    Open a relevant pull request => build login unlock point and undo all pass: 5: system
  section Edge case - broken journey
    One visible assertion fails => EAS reports a failed check with video and test result: 1: system
  section Edge case - unrelated change
    Open a pull request outside Android or shared => expensive workflow is skipped: 5: system
  section Teardown
    Smoke flow finishes => seeded operation returns to its initial unchecked state: 5: system
```

## Tasks to do

### `1)` Remove unused direct dependencies

> Shrink install and native-autolinking surface without substitutions.

1. Remove the six unused runtime packages and `@types/d3` identified by the audit.
2. Regenerate the lockfile and verify Expo compatibility, quality and export.
3. Apply only Expo-compatible advisory updates; leave upstream toolchain advisories documented instead of forcing overrides.

### `2)` Make existing Maestro flows repeatable

> Compose the two stable journeys once for local use and EAS.

1. Add `maestro/smoke.yaml` chaining `login-vault` then `check-operation`.
2. Read `MAESTRO_EMAIL`, `MAESTRO_PASSWORD` and `MAESTRO_PIN` in the login flow, retaining explicit local-seed fallbacks only for local development.
3. Expose the smoke flow as the Android package's `test:e2e` script and document its emulator/backend prerequisites.
4. Keep onboarding manual because it creates real accounts.

### `3)` Turn the existing EAS workflow into a pull-request gate

> Reuse Expo's first-party build plus Maestro workflow; do not add a duplicate GitHub Actions emulator job.

1. Run the one-time `eas init`, link the GitHub repository, and configure protected preview credentials for a deterministic account containing an unchecked `Loyer` fixture.
2. Replace branch-name push triggers with pull requests targeting `preview` or `main`, filtered to `android/**`, `shared/**` and workspace manifests; keep manual dispatch.
3. Run Maestro on a nested-virtualization runner with one retry, screen recording and a pinned verified Maestro version.
4. Burn in five consecutive green runs before making the EAS status required; the pre-packaged Maestro job is still marked alpha by Expo.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Expo export and quality pass with no import/config reference to a removed package.                                        |
| 2    | One documented local command deterministically signs in, unlocks, points and restores the seeded operation.               |
| 3    | A relevant pull request receives an EAS APK-plus-Maestro status while unrelated monorepo pull requests skip the workflow. |
