# Triggers

What a diff calls for, and why. Run every row whose trigger the diff matches, from the repository root unless the command says otherwise.

| The diff touches | Run | Why |
| --- | --- | --- |
| anything, in a fresh worktree | `pnpm install` (with scripts) | after `--ignore-scripts`, `backend-nest#lint` fails on « Bun's postinstall script was not run » |
| anything | `pnpm quality` | the lefthook pre-commit runs it only on `...[HEAD^]` and skips it on merge and rebase |
| `shared/**` | `pnpm build:shared`, `cd shared && pnpm test && pnpm typecheck:spec`, then the rows of every package that imports what changed | every package builds on `shared` |
| `shared/src/calculators/**`, `ios/Pulpe/Domain/Formulas/**`, `ios/Pulpe/Features/CurrentMonth/Reconciliation/AccountReconciliation.swift` | both sides' tests: `cd shared && pnpm exec vitest run src/calculators`, then the iOS suite; compare one shared input on web and iOS in the running apps | nothing fails when the TS and Swift twins diverge: web and iOS just show two amounts (`.claude/rules/00-architecture/formula-mirrors-ts-swift.md`) |
| `frontend/**` | `pnpm build:frontend`, `cd frontend && pnpm exec ng test --include "<touched specs>"`, then `pnpm test` | Angular templates (strictTemplates) are only checked by `ng build` |
| `frontend/**` on a user journey | `cd frontend && pnpm test:e2e --project="Critical User Journeys (Mocked)" --project="Feature Tests (Mocked)"`, then the journey with `drive-local-app` | the CI `e2e` unit runs those two projects |
| `backend-nest/**` | `cd backend-nest && bun run quality && bun test` | |
| `backend-nest/**` reading or writing the database | `cd backend-nest && supabase start && bun run test:integration` | a plain `bun test` returns early on integration specs and stays green |
| `backend-nest/supabase/migrations/**` | `git add backend-nest/supabase/migrations && s=$(git stash create) && node .github/scripts/check-migration-contract.cjs origin/main "${s:-HEAD}"`, `cd backend-nest && bun run supabase:reset && bun run generate-types:local`, then `git diff --exit-code backend-nest/src/types/database.types.ts` | the contract script reads commits only: with `HEAD`, a migration not yet committed is skipped and passes; `git stash create` snapshots the staged tree without moving any ref. Generated types drift silently after a schema change; never a destructive command on a linked database |
| an `amount`, `target_amount` or `ending_balance` write | a test or integration spec showing the stored value is a ciphertext | amounts are AES-256-GCM encrypted before the write (`docs/ENCRYPTION.md`) |
| an API request or response shape (`shared/schemas.ts`, a controller DTO) | the rows of both sides, and the Android Maestro smoke note in `aidd_docs/memory/testing.md` | the Preview backend serves `main`: a new request field stays red on Android until the backend ships |
| `ios/**` | `cd ios && xcodegen generate && xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO -parallel-testing-enabled NO` | a wrong `-scheme` prints its error and exits 0: only `** TEST SUCCEEDED **` proves the suite ran |
| `ios/**/*.swift` | `swiftlint lint --strict` from `ios/` | CI runs it strict |
| `android/**` | `cd android && pnpm quality && pnpm test`, then the journey on the emulator | PR #914 merged on green CI with no emulator check |
| `landing/**` | `cd landing && pnpm test && pnpm type-check && pnpm build`, then the page in the browser, on a phone width | v0.64.1: every internal link opened the next page at its bottom; only a browser showed it |
| a visible label, French copy or accessible name | `git grep -n "<old text>" -- frontend/e2e android/maestro ios/PulpeUITests` and fix what it finds; `pnpm test:lexicon` | Maestro flows tap visible French text and part of the Playwright specs use `getByRole` names; « transaction » never shows on screen |
| `.github/**` | `pnpm quality:automation`, `actionlint` | CI runs both; `.github/actions/**` and `start-supabase.sh` only prove themselves on a full CI run |
| `package.json`, `pnpm-lock.yaml`, `turbo.json`, a new dependency | `pnpm build && pnpm test && pnpm deps:check && pnpm audit:critical` | root contracts invalidate every CI shortcut |
| level `pr` | every row above on a head up to date with `origin/main` (`git merge-base --is-ancestor origin/main HEAD`) | `✅ CI Success` fails a run whose tested base is no longer the tip of `main` |
| level `release` | the `pr` level on the release branch head, then the `release` skill's own gates | the release skill owns versions, notes and promotion |

## Known noise

- `backend-nest/src/modules/currency/__tests__/currency.service.test.ts` can count `fetch` calls made by other tests (failed once on release PR #929). Report it as pre-existing; never retry it until green.
