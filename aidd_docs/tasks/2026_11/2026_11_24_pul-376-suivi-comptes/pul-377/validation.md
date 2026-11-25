# PUL-377 validation (uncommitted change, branch feat/pul-377-valeur-suit-pointage)

Suites run: shared 952 pass; backend `bun test src/modules/asset` 63 pass; frontend net-worth + reconcile-accounts + core/asset 248 pass. iOS and SQL tests read only (not run, per brief).

F = backend-nest/src/modules/asset/domain/asset.formulas.spec.ts
U = backend-nest/src/modules/asset/application/get-net-worth.use-case.spec.ts

| CA | Test | Verdict |
|---|---|---|
| CA1 | F:258 (10 500 / net 2 500), U:141 | proven |
| CA2 | F:268 (7 700, debts 7 700, net 2 300) | proven |
| CA3 | F:277 (9 000) | proven |
| CA4 | F:283 (empty checkedLines => 10 000, net 2 000) | proven (models "line absent", the repo filter itself is not exercised end to end) |
| CA5 | F:290 (12 000 then +200 => 12 200), U:182 + supabase-asset.repository.spec.ts:255,304 (cutoff, line at cutoff dropped) | proven |
| CA6 | F:302 (200 - 300 => 0) | weak: second half (then a 100 purchase => 100, chronological order) has no test. Sort exists at asset.formulas.ts:141 but nothing asserts it |
| CA7 | F:320 (sum of shown = totals, category total) | proven for backend. Web/iOS page tests show API totals untouched (net-worth-page.spec.ts:206, NetWorthSectionsTests:23); Sankey not tested with updated values |
| CA8 | frontend net-worth-asset-row.spec.ts:214 (payload with suggestion shows no Je propose/Appliquer/Écarter); iOS NetWorthSuggestionRow.swift deleted | proven web; iOS by deletion only (no test) |
| CA9 | row.spec:162 (+500.00 CHF depuis ta saisie du 3 novembre), :176 (debt -300), :208 (absent when nothing moved); iOS NetWorthSectionsTests:130,139,146 | proven |
| CA10 | asset-form-dialog.spec.ts:235 (prefill 10500 + "Ta dernière saisie : 10'000.00 CHF, le 3 novembre 2026", no write when untouched); iOS AssetFormDraftTests:109, NetWorthSectionsTests:153 | proven |
| CA11 | none | missing: no test asserts that checking/unchecking writes no asset_snapshot (true by construction, nothing proves it) |
| CA12 | core/asset/asset-api.spec.ts:202 (budget cache invalidation marks assets cache stale) | proven at unit level; no e2e journey (net-worth.spec.ts e2e only had fixture field additions) |
| CA13 | reconcile-accounts-step.spec.ts:166 (10'500.00 CHF caption); iOS ReconcileLinkedAccountsTests:25 | proven |
| CA14 | F:354 (EUR 0.93 => 10 537.63), F:366 (no rate => last entry, incomplete), U:157, U:169 | proven |
| CA15 | F:375 (archived keeps 10 000, totals 0) | proven |
| CA16 | no dedicated test; follows from CA1 (last entry + checked since) | weak: implicit only |
| CA17 | backend-nest/supabase/tests/asset_dismissed_suggestion_conversion.sql (Livret 10 000 copied, dated from dismissal, idempotent twice, trigger once per dismissal, applied asset untouched); +200 => 10 200 via F:290 | weak: the SQL re-types the INSERT instead of running the migration file, and was not run here (no Supabase). The "+200 => 10 200" half is not asserted in the SQL itself |
| CA18 | dismiss-asset-suggestion.use-case.spec.ts:37 (read-only repo, returns asset unchanged), :43 (not found); shared/src/asset-schema.spec.ts:207,215 (suggestion null, old schema without recordedValue parses); iOS AssetCodableTests:13 | proven (route still declared in controller, HTTP wiring untested; `latestValue` = up-to-date value covered by CA1) |

## Weak or missing
- CA11 missing
- CA6 weak (chronological clamp: 200, -300, then +100 => 100 untested)
- CA16 weak (implicit)
- CA17 weak (SQL not run, duplicates migration body)

## Follow-up (orchestrator)

- CA11: covered now. `backend-nest/supabase/tests/asset_dismissed_suggestion_conversion.sql` checks then unchecks a prévision linked to the Livret through `toggle_budget_line_check`, as the owner, and asserts the snapshot count does not move. Proven to bite: a scratch trigger that writes a snapshot on `checked_at` makes it fail with "FAIL: checking or unchecking must not write a snapshot".
- CA6: the criterion itself (200, repayment 300 => 0) is proven. The ordering half of the rule (a purchase of 100 checked afterwards => 100) needs a movement that raises a debt, which only exists once a purchase can carry an account (PUL-378). Its test lands with PUL-378.
- CA16: the old suggestion was `last snapshot + checked since max(last snapshot, dismissal)`. Without a dismissal it is exactly the new value, so CA1 (10 000 + 500 => 10 500) proves it.
- CA17: the SQL test retypes the migration's INSERT because the migration is already applied locally (re-running its CREATE TRIGGER would fail). Both statements are identical; the "+200 => 10 200" half is the CA5 formula test.
- CA8 on iOS: the view that showed the proposal is deleted and nothing references `suggestion` anymore (`Asset` no longer decodes it). No test asserts an absence.

## Follow-up 2 (after supervision)

Every suite below was run on the current tree, not read:

- CA6: unchanged. The ordering half moves to PUL-378 (see above).
- CA16: explicit test `get-net-worth.use-case.spec.ts` « CA16: a proposal still waiting for a click at go-live is simply the value » (10 000 + 500 → 10 500, entry kept at 10 000).
- CA17:
  - `get-net-worth.use-case.spec.ts` « CA17: … a later Épargne of 200 brings the Livret to 10 200 ». The cutoff is the dismissal date, and the 500 checked before it is never asked for.
  - The SQL test now runs the real migration file twice and asserts only `ct-200` is checked after the copied entry.
- CA11: proven through the real `toggle_budget_line_check` RPC as the owner (SQL above).
- Results:
  - `bun test` (backend, with the local ANON/SERVICE_ROLE keys): 2145 pass, 0 fail.
  - `bun run quality` (backend): OK.
  - `pnpm test` (shared): 952 pass.
  - `ng test --include "**/feature/net-worth/**/*.spec.ts"`: 91 pass.
  - SQL `asset_*` suites (3 files): 0 errors.
  - iOS `xcodebuild test`, 12 suites: 112 tests passed.
  - `swiftlint --strict`: 0 violations.
  - Signed iOS build: OK.
- Android compatibility (found while challenging the work): `recordedValue`, now required in `shared`, broke `tsc` on five Android spec fixtures. The fixtures are fixed, with no screen change. Android `type-check`, `lint` and `format:check` pass, and `jest src/features/net-worth src/features/current-month` gives 302/302.
- Frontend full `ng test`: 3688/3688. `ng build`: OK. `pnpm test:lexicon`: 12/12. `pnpm test:public-surface`: 8/8.
- iOS rerun after the stacked-row alignment fix: 112 tests in 12 suites passed.
- The captures under `shots/` stay out of git: the repo refuses binary files in `aidd_docs/tasks` (`.github/scripts/public-surface.test.mjs`).
