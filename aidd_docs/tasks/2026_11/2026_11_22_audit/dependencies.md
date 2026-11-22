# Codebase Audit: « Comparer avec mes comptes » (dependencies)

The feature adds or changes no dependency: no manifest, lockfile or Swift package file differs from `origin/main`, and every third-party import it introduces resolves to a package already declared in its workspace.

- **Date**: 2026_11_22
- **Scope**: dependency manifests touched by `git diff origin/main` + the uncommitted tree of `claude/reconciliation-onboarding-redo` (HEAD `5ed3423a2`, base `b3656f067`), and the third-party imports added by the feature's files
- **Health**: good
- **Findings**: 0 critical, 0 major, 0 minor

## Findings

No finding.

| Check | Evidence | Result |
| --- | --- | --- |
| Manifests and lockfiles changed | `git diff origin/main --name-only` and `git status --untracked-files=all` match none of `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `bun.lock(b)`, `Package.swift`, `Package.resolved`, `ios/project.yml`, `Podfile(.lock)`, `build.gradle`, `app.json` | nothing changed |
| New third-party imports are declared | `zod` 4.6.6 (`android/package.json:69`, `shared/package.json:30`, `backend-nest/package.json:77`, `frontend/package.json:79`), `react-native-mmkv` 4.3.2 (`android/package.json:60`), `@tanstack/react-query` (`android/package.json:31`), `react-native-reanimated` 4.5.1 (`android/package.json:64`), `@expo/vector-icons` (`android/package.json:25`), `nestjs-zod` (`backend-nest/package.json:69`), `supertest` (`backend-nest/package.json:96`, dev), `@angular/cdk` 22.2.7 (`frontend/package.json:47`); iOS files import only `Foundation`, `SwiftUI` and `Testing` | all declared, no phantom dependency |
| Direct git/URL dependencies, missing integrity | none introduced (no manifest change) | n/a |

## Top actions

1. None.

## Coverage

- **Scanned**: dependencies
- **Skipped**: CVE scan (`pnpm audit`) and outdated/licence checks over the existing tree, out of scope: the request limits this pillar to what the feature added or changed, and it changed nothing.
