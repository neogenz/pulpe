# Testing

## Strategy

- Co-located unit tests cover pure logic/components; backend integration tests use local Supabase; Playwright and XCUITest cover user flows.

## Tools

- Vitest for Angular/shared, Bun Test for backend, `tsx --test` for landing, Swift Testing for iOS units, Playwright/XCUITest for UI.

## Conventions

- Frontend/shared use `*.spec.ts`; backend uses `*.spec.ts` or `*.test.ts`, with `*.integration.spec.ts`/`*.e2e.spec.ts` for integration; landing uses `*.test.*`.
- iOS tests live in `PulpeTests` and `PulpeUITests`.
- A Playwright run asserting a non-French UI must pin the `pulpe-settings-language` snapshot; mock `GET /users/settings.locale` only when the scenario tests server-preference precedence. An absent server locale is intentional and must remain `undefined`: `UserSettingsStore` then preserves the startup resolution (snapshot, CTA, browser, French) instead of manufacturing and persisting a French preference.
- Browser fixtures that use `__E2E_AUTH_BYPASS__` must serve an Angular development build: `isE2EMode()` deliberately rejects the bypass outside dev mode. Production-build browser QA is limited to flows that do not need this fixture auth.
- Backend-free iOS visual QA should reuse the `UITEST_CONTEXTUAL_CREATION_HOME` harness through `PulpeUITests`; its launch environment already covers large text, color schemes, fresh-signup, chart, skeleton, and hidden-amount states.
- Keep tracked AIDD QA reports textual. Put screenshots and videos under the task's `evidence/` directory, which is intentionally ignored; `test:public-surface` rejects binary files tracked in `aidd_docs/tasks/`.

## Run

- `pnpm test`; `pnpm test:e2e`; `cd backend-nest && bun run test:integration`; package-scoped commands are in `CLAUDE.md`.
- Root pnpm commands do not include iOS; generate the Xcode project and run `xcodebuild test -scheme PulpeTests` separately. A wrong `-scheme` prints its error and still exits 0, so only `** TEST SUCCEEDED **` in the log proves the suite ran.
