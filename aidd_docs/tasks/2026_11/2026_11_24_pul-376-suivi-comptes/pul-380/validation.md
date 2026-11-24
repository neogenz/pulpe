# PUL-380 validation (branch feat/pul-380-projection-fin-de-mois, `f608d037b..HEAD` at c1a7e6579)

Suites run on the current tree (HEAD c1a7e6579, working tree: only `questions.md` items and untracked shots / iOS DerivedData). Machine load average 200–300 during the runs.

- Backend, full: `SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY bun test` (keys from `supabase status -o env` in the main repo): 2308 pass, 21 skip, 3 fail, 2332 tests across 217 files. The 3 failures are all in `savings-goal.integration.spec.ts` (CA7 RLS, two PUL-319 deletion scopes), each « timed out after 5000ms »; that file is untouched by the diff and passes alone (`bun test --timeout 30000 src/modules/savings-goal/savings-goal.integration.spec.ts`: 10 pass, 0 fail). Asset module alone (`bun test src/modules/asset`): 165 pass, 0 fail.
- SQL: every `backend-nest/supabase/tests/*.sql` via `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f <file>`: 33/34. Only failure `user_feedback_rls.sql` (`FAIL: exactly one owner row must remain, found 2`), known and unrelated. No migration in this diff.
- Read query, live (read-only, PostgREST on :54321 with the service key): the exact `findMonthMovements` select (`monthly_budget!inner(month, year, user_id)` + `or=(account_id.eq.X,asset_id.eq.X)`) on a local Compte courant holding the contract set (Loyer, Salaire, Assurance in November 2026, « Impôts » in December 2026): month 11 → 3 rows, all November; month 12 → 1 row (Impôts). The same filter with a plain embed (no `!inner`) → 4 rows: the `!inner` is what keeps Impôts out.
- Shared: `pnpm build:shared` OK; `cd shared && pnpm test`: 993 pass (34 files).
- Web: `cd frontend && pnpm test`: 3797 pass (267 files); `pnpm run typecheck:spec` OK; `pnpm run build` OK (csp-check OK); root `pnpm test:lexicon`: 12/12 pass; `pnpm exec playwright test tests/features/net-worth.spec.ts`: 3 passed (17.1 s), :4200 free before and after.
- Android: `pnpm exec jest`: 1594 pass (224 suites); `tsc --noEmit`, `eslint .`, `prettier --check .`: all exit 0.
- iOS: `xcodegen generate --use-cache` then `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath .build-dd-pul377-tests CODE_SIGNING_ALLOWED=NO`: « Test run with 2783 tests in 317 suites passed », `** TEST SUCCEEDED **` (XCTest bundle: 0 executed, as in PUL-379). The PUL-380 tests are in the executed log: `label_inEachLanguage` (4 cases), `label_signsANegativeProjectionLikeTheValue`, `accessibilityLabel_addsTheCondition` (4), `getHistory_decodesTheMonthEndProjection` (3), `reload_withTheSameFirstPage_takesTheFreshProjection`.

Abbreviations:
F = backend-nest/src/modules/asset/domain/asset.formulas.spec.ts, describe "monthEndValue: the value once the month is all checked (PUL-380)". Its `project()` values the asset through the real `computeNetWorth` (as `GET /v1/assets`) and then calls `monthEndValue`, so each test pins both the value and the projection. Contract set: entry 5 000 on 1 Nov, 1 200 of Dépenses checked since (value 3 800), Loyer 1 500, Assurance 300, Salaire 6 000 not checked.
UC = backend-nest/src/modules/asset/application/get-asset-history.use-case.spec.ts, describe "the month-end projection (PUL-380)"; H = .../infrastructure/http/asset-history.http.spec.ts; R = .../infrastructure/persistence/supabase-asset.repository.spec.ts, describe "findMonthMovements"; S = shared/src/asset-history-schema.spec.ts
wD = frontend/projects/webapp/src/app/feature/net-worth/detail/asset-detail-page.spec.ts, describe "month-end projection (PUL-380)"; wS = .../detail/asset-history-store.spec.ts; e2e = frontend/e2e/tests/features/net-worth.spec.ts
iM = ios/PulpeTests/Features/NetWorth/AssetHistoryModelTests.swift (suite "AssetMonthEndProjection label", test `reload_withTheSameFirstPage_takesTheFreshProjection`); iS = ios/PulpeTests/Domain/Services/AssetServiceTests.swift
aD = android/src/features/net-worth/asset-detail-screen.spec.tsx, describe "the month-end projection in the detail (PUL-380)"
Captures = pul-380/shots/<file>. No android-* capture exists at the time of writing.

The projection is computed on the server only; clients render `monthEndProjection`. CA2–CA5, CA9, CA10 are server CAs; for the clients the CAs to prove are CA1, CA6/CA7 (no line when `null`) and CA8 (nothing else on screen changes).

| CA | Platform | Proof | Verdict | Note |
|---|---|---|---|---|
| CA1 | server | F "CA1: the Compte courant at 3 800 ends November at 8 000" (`{ value: 3_800, projection: 8_000 }`); UC "reads the current budget: November on 12 November without a payday" (`findMonthMovements(id, 11, 2026)`), "reads the budget of the payday: December on 28 November with a payday on the 27th" (→ 12); H "PUL-380 CA1: answers the month-end projection beside the asset" (`{ month: 11, year: 2026, value: 8_000 }` through `assetHistoryResponseSchema`) | proven | `monthEndValue` is new: every F assertion fails without it |
| CA1 | web | wD "CA1: shows « Fin novembre : 8’000.00 CHF » between the value and my last entry" (exact text, value 3’800.00 CHF, order type → value → month-end → last entry); wD "CA1: says the condition to a screen reader…"; e2e "opens the detail of a row at its own address…" (`asset-detail-month-end` contains « Fin novembre : 8’000.00 CHF », run green); web-compte-courant-mobile-light.png: 3’800.00 CHF, « Fin novembre : 8’000.00 CHF », « Ta dernière saisie : 5’000.00 CHF », local demo account whose November budget holds Loyer, Assurance, Salaire not checked and Courses 1 200 checked (DB read) | proven | The capture is a real server answer: end-to-end CA1 |
| CA1 | iOS | iM `label_inEachLanguage` (fr « Fin novembre : 8’000.00 CHF », en/de/it); `accessibilityLabel_addsTheCondition`; iS `getHistory_decodesTheMonthEndProjection` (present / `null` / absent); captures ios-detail-projection-light/dark/ax5.png show « Fin novembre : 13’620.00 CHF » under 9’420.00 CHF | proven | Text proven by the label test; the view's `Text(projection.label(...))` is read, not tested; captures use the PUL-379 harness amounts (9 420), not 8 000 |
| CA1 | Android | aD "CA1 shows « Fin novembre : 8’000.00 CHF » beside the value" (and « Comptes 3’800.00 CHF »), "CA1 reads the line with what it assumes", "names the month in the interface language" | proven | No capture |
| CA2 | server | F "CA2: checking Loyer moves the value to 2 300, the projection stays 8 000"; F "CA2 invariant: once everything is checked, the value is the projection of before" (value 8 000, projection `null`) | proven | No cache on the read (questions.md #12), read |
| CA3 | server | F "CA3: Assurance at 400 moves the projection to 7 900, not the value" (`{ value: 3_800, projection: 7_900 }`) | proven | |
| CA4 | server | UC "CA4, CA9: projects November only, Impôts of December left out" (mock answers Impôts only for month ≠ 11; projection 9 380 = 9 420 − 40, would be 7 420 if December were read); R "reads only that month of the user…" (`eq` month 11, year 2026, user_id; `or account_id/asset_id`); live PostgREST check above (Impôts only in month 12) | proven | R does not assert the `!inner` in the select string; the live check shows that without it the month filter does nothing (Gap 1) |
| CA5 | server | F "CA5: Courses 400 with 450 of movements, 100 checked, counts for 450: 350 still to come" (value 3 700, projection 3 350 = 3 800 − 450) | proven | Entry 3 800 instead of the CA1 set, as in plan.md |
| CA6 | server | F "CA6: nothing left to come, no projection" (`projection: null`); F "CA6: a prévision of 400 checked with a movement of 450 not checked leaves 50 to come" (value 3 400, projection 3 350) | proven | « Nothing to come » = no rest, not « projection = value » (questions.md #5) |
| CA6/CA7 | web | wD "CA6, CA7: shows no line when nothing is to come this month" (`null` → no `asset-detail-month-end`); wD "shows no line when the server does not send the projection yet"; wS "PUL-380: reads a missing projection as none"; web-livret-mobile-light.png (Livret 10’000.00 CHF, no « Fin » line) | proven | |
| CA6/CA7 | iOS | iS decode test (`null` and absent → `nil`); iM `reload_withTheSameFirstPage_takesTheFreshProjection` (projection back to `nil` after a reload); ios-livret-epargne-no-projection.png (Livret épargne 10’000.00 CHF, no « Fin » line) | proven | The `if let` in `AssetDetailView` is read; the capture shows the result |
| CA6/CA7 | Android | aD "CA6 CA7 shows no line when nothing is to come", "shows no line when a server without the field answers" | proven | |
| CA7 | server | F "CA7: nothing planned nor typed this month, no projection"; F "CA9, CA7: Pharmacie 40 …" (shown with Pharmacie alone); UC "CA7: nothing to come this month, no projection"; H "PUL-380 CA7: answers null when nothing is left to come" | proven | |
| CA8 | server | UC "CA8: the asset and its history are the same with or without the month" (`asset`, `entries`, `nextCursor` equal, projection not null); `GET /v1/assets` untouched (`assetSchema` unchanged, `get-net-worth` not in the diff) | proven | Snapshots: the projection is never written (no write path in the diff) |
| CA8 | web | wD CA1 (value stays 3’800.00 CHF next to 8’000.00; only `asset-detail-month-end` is added to the summary); all PUL-379 wD tests unchanged and green | proven | |
| CA8 | iOS | Captures ios-detail-projection-light.png (9’420.00 CHF, last entry and history as PUL-379's ios-fr-detail-light.png) | partial | No test that the value is unchanged when a projection is present; the view reads `asset.latestValue` (read) |
| CA8 | Android | aD CA1 (« Comptes 3’800.00 CHF » with the 8’000.00 line); PUL-379 aD tests unchanged and green | proven | |
| CA9 | server | F "CA9, CA7: Pharmacie 40 typed and not checked takes 40 off, and is enough to show it" (`{ value: 3_800, projection: 3_760 }`); UC "CA4, CA9" (−40); R "reads the prévisions of the asset with all their movements, and its free movements, checked or not" (Pharmacie read as a free movement) | proven | |
| CA10 | server | F "CA10: an entry of 4 900 after 100 checked on Courses does not count them twice" (`{ value: 4_900, projection: 4_550 }`) | proven | |

Not in the contract, tested anyway: debt floor (F "floors the result of a debt at zero: 200 − 300 + 80 = 0", "…raises it to 280"), two links (F "an Épargne 500 … moves both": 3 300 / 10 500), EUR (F "converts each rest at today's rate…": 900 EUR), no rate and archived → `null`; masking (wD "hides the projection with the other amounts", aD "hides the amount like the value…"); negative sign U+2212 (wD, iM, aD).

Per platform:

| Platform | Verdict | Open |
|---|---|---|
| Server + shared | proven | `!inner` not pinned by a unit test (Gap 1) |
| Web | proven | none |
| iOS | proven except CA8 (partial) | CA8 by capture only; no capture with 8 000 |
| Android | proven | no capture |

## Gaps

Ranked by impact.

1. **CA4, server: the month filter rests on an untested `!inner`.** `findMonthMovements` filters on `monthly_budget.month/year/user_id`; PostgREST applies those to the parent rows only because the embed is `monthly_budget!inner(...)`. The live check shows that without `!inner` the same query returns the December « Impôts » too (4 rows instead of 3), and R would stay green: it asserts the `eq`/`or` calls but not the select string. Smallest fix: in R "reads only that month of the user…", assert `lines.argsOf('select')` and `free.argsOf('select')` contain `monthly_budget!inner(month, year, user_id)`.
2. **CA8, iOS: no test.** The value next to the line is `asset.latestValue`, read, and the captures show it unchanged, but nothing fails if the projection were shown in its place. Smallest fix: one capture or a view-model assertion that `model.asset.latestValue` is untouched when `monthEndProjection` is set (or accept the capture, as PUL-379 did for CA2 iOS).
3. **No capture with the contract amounts on iOS, none at all on Android.** iOS captures show 13’620 / 9’420 (PUL-379 harness); Android has no `android-*` file yet. Text and amounts are proven by tests on both; this only affects visual review (AX5 is captured and wraps without truncation on iOS). Smallest fix: the pending Android captures (font 1.0 and 1.3, light and dark), per plan.md phase 4.
4. **CA6 wording vs. decision.** Contract: « la projection est égale à la valeur et la ligne n'est pas affichée ». Code: `null` when no movement has a rest (questions.md #5), so a Revenu 300 and a Dépense 300 to come show « Fin novembre : 3 800 », equal to the value. Recorded decision; needs the contract text, not the code.
5. **Scope.** Android is in scope by decision (questions.md #1) though the contract lists it out of scope; the contract should say so.
6. **Load-sensitive backend failures (unrelated).** `savings-goal.integration.spec.ts` times out at 5 s under load and passes with `--timeout 30000`. Not caused by this diff.

## After validation

Fixes landed after this report, on the same branch:

- **Gap 1 closed** by `97909d2f5`: R "reads only that month of the user…" now asserts `monthly_budget!inner(month, year, user_id)` in both select strings. Proven both ways: 27 pass / 1 fail with `!inner` removed, 28/28 with it.
- **Projection read from the first page on every client.** Web (`298796c2c`, `AssetHistoryStore.monthEndProjection` reads `firstPage`; wS "keeps the month-end projection of the first page when a later page loads": 8 000 stays after a later page answering 7 900) and Android (`c7a722f88`, aD "reads the projection from the first page, like the asset", red before the fix, green after). iOS already read the first page.
- **Web line in caption style** (`298796c2c`): `text-body-medium text-on-surface-variant tabular-nums`, like iOS and Android.
- **Gap 3, Android captures**: `android-detail-{light,dark}-{1.0,1.3}.png` and `android-livret-no-projection-light-1.0.png`, demo data, without the Expo dev button.

Still open: Gap 2 (iOS CA8 by capture only), Gap 4 (CA6 wording), Gap 5 (Android scope in the contract), iOS captures with the PUL-379 amounts rather than 8 000.
