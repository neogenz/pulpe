# Codebase Audit: Android — tests

Pure business logic, crypto helpers, API parsing and view-models are well tested. The gap is at the application boundary: account purge and route/component behavior have little or no automated coverage.

- Date: 2026-08-16
- Scope: Jest suites, coverage, Maestro flows and Android CI scripts
- Health: good
- Findings: 0 critical, 2 warnings, 0 minor

## Findings

| Sev | Category | Location                                      | Issue                                                                                                                                                                    | Suggested fix                                                                                                                                                                | Effort |
| --- | -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Tests    | `android/src/core/auth/session-store.ts:39`   | Sign-out and `purgeLocalAccountData` have 0% coverage even though a regression could retain the previous account's query cache, vault state or client keys.              | Add one focused store test that asserts Supabase sign-out, cache clear, vault reset, landing reset and key deletion occur before the session becomes anonymous.              | S      |
| 🟡  | Tests    | `android/.eas/workflows/deploy-preview.yml:6` | EAS already builds an APK and invokes Maestro, but only for branch-name pushes; no package script exists, and release docs say the uninitialized workflow has never run. | Compose the stable flows behind one local script, initialize EAS with a deterministic preview fixture, then use a path-filtered pull-request check after a five-run burn-in. | M      |

## Top actions

1. Protect account separation with `aidd-dev:06-test` around sign-out/purge.
2. Make the two stable Maestro flows runnable from one package script and turn the existing EAS workflow into a path-filtered pull-request gate.

## Coverage

- Scanned: 64 Jest suites, 472 tests, source coverage, test naming, route/component coverage, Maestro definitions and GitHub workflows.
- Verified: all 472 tests pass; coverage is 27.83% statements, 27.69% branches, 23.42% functions and 27.18% lines.
- Skipped: actual Maestro execution; it requires an emulator, installed build and backend account/session not present in this audit environment.
