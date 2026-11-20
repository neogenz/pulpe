# Assert: Android home hero parity with iOS

## Round 1

- Head: `20067ec50`
- Uncommitted changes: yes
- Verdict: FAIL

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm run type-check` (android) | 2 | `src/features/transactions/store-review-prompt.ts(39,38): error TS2307: Cannot find module 'expo-store-review'` |
| `pnpm run lint` (android) | 1 | `39:38  error  Unable to resolve path to module 'expo-store-review'  import/no-unresolved` |
| `pnpm run format:check` (android) | 0 | |
| `pnpm exec jest --runInBand src/features/current-month src/core/ui src/core/i18n src/features/budgets src/features/net-worth` (android) | 0 | |
| `pnpm test:lexicon` (root) | 0 | |

## Round 2

- Head: `20067ec50`
- Uncommitted changes: yes
- Verdict: PASS

Round 1 failed on a dependency declared in `android/package.json` but missing from this worktree's `node_modules`; `pnpm install --frozen-lockfile` fixed it, no source change.

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm run type-check` (android) | 0 | |
| `pnpm run lint` (android) | 0 | |
| `pnpm run format:check` (android) | 0 | |
| `pnpm exec jest --runInBand src/features/current-month src/core/ui src/core/i18n src/features/budgets src/features/net-worth src/app` (android) | 0 | |
| `pnpm test:lexicon` (root) | 0 | |
