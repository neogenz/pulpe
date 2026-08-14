# Testing

## Strategy
- Co-located unit tests cover pure logic/components; backend integration tests use local Supabase; Playwright and XCUITest cover user flows.

## Tools
- Vitest for Angular/shared, Bun Test for backend, `tsx --test` for landing, Swift Testing for iOS units, Playwright/XCUITest for UI.

## Conventions
- Frontend/shared use `*.spec.ts`; backend uses `*.spec.ts` or `*.test.ts`, with `*.integration.spec.ts`/`*.e2e.spec.ts` for integration; landing uses `*.test.*`.
- iOS tests live in `PulpeTests` and `PulpeUITests`.
- A Playwright run asserting a non-French UI must pin both the mocked `GET /users/settings` and the `pulpe-settings-language` snapshot: `e2e/utils/auth-bypass.ts` omits `locale`, the read schema defaults it to `fr`, `UserSettingsStore` persists that, and `resolveStartupLanguage` prefers the snapshot over the browser language.

## Run
- `pnpm test`; `pnpm test:e2e`; `cd backend-nest && bun run test:integration`; package-scoped commands are in `CLAUDE.md`.
- Root pnpm commands do not include iOS; generate the Xcode project and run `xcodebuild test -scheme PulpeTests` separately. A wrong `-scheme` prints its error and still exits 0, so only `** TEST SUCCEEDED **` in the log proves the suite ran.
