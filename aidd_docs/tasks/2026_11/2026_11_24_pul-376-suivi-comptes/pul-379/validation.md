# PUL-379 validation (branch feat/pul-379-detail-historique, `496668322..HEAD` at 3e23bcd63)

Suites run on the current tree (HEAD 3e23bcd63, working tree clean apart from `questions.md` items 16–29 and the untracked shots):

- Backend, full: `SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY bun test` (keys from `supabase status -o env` in the main repo): 2281 pass, 21 skip, 0 fail, 2302 tests across 217 files.
- SQL: every `backend-nest/supabase/tests/*.sql` via `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f <file>`: 33/34. The only failure is `user_feedback_rls.sql` (`FAIL: exactly one owner row must remain, found 2`): shared local DB pollution, unrelated. `asset_history_movements.sql`: « OWNER ASSERTIONS PASSED », « ALL ASSERTIONS PASSED ». Migration `20261126120000` is applied on the local DB.
- Migration contract: `node .github/scripts/check-migration-contract.cjs 496668322 HEAD`: « Migration contract valid (1 new file(s)) ».
- Shared: `pnpm build:shared` OK; `cd shared && pnpm test`: 987 pass (34 files).
- Web: `cd frontend && pnpm test`: 3783 pass (267 files); `pnpm run typecheck:spec` OK; `pnpm run build` OK (csp-check OK); root `pnpm test:lexicon`: 12/12 pass. The Playwright e2e was not run (it needs a dev server on :4200).
- Android: `pnpm exec jest`: 1582 pass (224 suites); `tsc --noEmit`, `eslint .`, `prettier --check .`: all OK.
- iOS: `xcodegen generate --use-cache` then `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath .build-dd-pul377-tests CODE_SIGNING_ALLOWED=NO`: 2771 tests in 315 suites passed, 0 failed (Swift Testing; the XCTest bundle executed 0). Suites "AssetHistoryModel", "AssetHistoryLine" and both `getHistory_*` tests are in the executed log.

Abbreviations:
F = backend-nest/src/modules/asset/domain/asset.formulas.spec.ts, describe "assetHistory: the history follows the rule of the value (PUL-379)" (contract jeu d'essai: 4 800 on 1 Oct, Assurance −300, 5 000 on 1 Nov, Loyer −1 500, Restaurant −80, Salaire +6 000)
UC = backend-nest/src/modules/asset/application/get-asset-history.use-case.spec.ts; H = backend-nest/src/modules/asset/infrastructure/http/asset-history.http.spec.ts; SQL-H = backend-nest/supabase/tests/asset_history_movements.sql; R = supabase-asset.repository.spec.ts
wD = frontend/.../feature/net-worth/detail/asset-detail-page.spec.ts; wS = .../detail/asset-history-store.spec.ts; wP = .../net-worth/net-worth-page.spec.ts; wR = .../components/net-worth-asset-row.spec.ts; e2e = frontend/e2e/tests/features/net-worth.spec.ts (not run)
iM = ios/PulpeTests/Features/NetWorth/AssetHistoryModelTests.swift (suites "AssetHistoryModel", "AssetHistoryLine"); iS = ios/PulpeTests/Domain/Services/AssetServiceTests.swift
aD = android/src/features/net-worth/asset-detail-screen.spec.tsx; aR = android/src/features/net-worth/components/net-worth-rows.spec.tsx
Captures = pul-379/shots/<file>. A capture counts as proof only where noted that it shows the contract text and amounts.

| CA | Platform | Proof | Verdict | Note |
|---|---|---|---|---|
| CA1 | web | wR "CA1: opens the detail from a tap on the row, beside the menu and never around it" (emits `open`, not `edit`); wP "CA1, CA16: opens the detail of a tapped row at its own address, never the edit sheet" | proven | |
| CA1 | iOS | Code read: `NetWorthAssetRow` row Button → `actions.open` → `pushOnActiveStack(NetWorthDestination.asset)`; captures ios-fr-detail-light.png (detail reached) | partial | No test asserts a tap pushes the detail instead of « Modifier » |
| CA1 | Android | aR "CA1 opens the detail on a tap, and says so to TalkBack" (open called, edit not); `net-worth.tsx:111` pushes `/asset/:id` (read); android-01-detail-light-1.0.png | proven | Push target read, not tested |
| CA2 | server | UC "CA2: the header is the Compte courant at 9 420, last entry 5 000 on 1 November, as on Mon patrimoine" (equal to `GetNetWorthUseCase` output); H "answers the asset as on Mon patrimoine…" (latestValue 9 420, recordedValue 5 000) | proven | |
| CA2 | web | wD "CA2: shows the name, the type, the value today and my last entry" (Compte courant, Comptes, 9’420.00 CHF, « Ta dernière saisie : 5’000.00 CHF, le 1er novembre »); web-detail-mobile-light.png, web-detail-desktop-light.png | proven | |
| CA2 | iOS | Capture ios-fr-detail-light.png: « Compte courant », « Comptes », 9’420.00 CHF, « Ta dernière saisie : 5’000.00 CHF, le 1er novembre » | proven | Capture only; no view test of the header |
| CA2 | Android | aD "CA2 shows the name, the type, the value today and my last entry" (« Comptes 9’420.00 CHF », « Ta dernière saisie : 5’000.00 CHF, le 1er novembre »); android-01-detail-light-1.0.png | proven | |
| CA3 | server | F "CA3: one list, newest first, entries and movements mixed"; UC "CA3, CA5: the whole history in one page…" | proven | Exact contract order |
| CA3 | web | wD "CA3, CA7: lists entries and checked movements newest first, down to the first entry"; web-detail-desktop-light.png | proven | Renders server order (fixture) |
| CA3 | iOS | iS "getHistory_decodesTheContractDataSet_newestFirst" (order kept through decoding); iM "load_thenLoadMore_appendsUntilNoCursor"; ios-fr-detail-scrolled-light.png (full list in contract order) | proven | |
| CA3 | Android | aD "CA3 lists entries and movements in one list, newest first"; android-02-detail-scrolled-light-1.0.png | proven | |
| CA4 | server | F "CA4: each movement shows its name, check date and signed effect…" (+6 000, −80, −1 500, −300, snapshots 5 000 / 4 800); R "findSnapshots: decrypts every entry of the asset, oldest first" | proven | Every `asset_snapshot` row is read, whatever wrote it (Modifier, rapprochement, Appliquer): no source filter (read) |
| CA4 | web | wD "CA4: gives each movement its check date and signed effect, each entry its value" (+6’000.00, −80.00, −1’500.00, 5’000.00, −300.00, 4’800.00; « 1er novembre ») | proven | |
| CA4 | iOS | iM "movement_readsNameDateAndSignedEffect", "snapshot_readsRecordedValue"; ios-fr-detail-light.png | proven | iOS adds « Pointé le » before the date; web/Android show the date alone |
| CA4 | Android | aD "CA4 signs each movement's effect and shows each entry's value" | proven | |
| CA5 | server | F "CA5: … (+4 420)" (442 000 cents = (9 420 − 5 000)×100), "CA5 invariant: rounding, a debt touching zero and a foreign currency…"; UC "CA3, CA5" (open = 4 420 = value − recordedValue) | proven | Invariant tested on EUR rate 0.93 and a debt floor |
| CA5 | web | wD "CA5: keeps the movements above my last entry as the ones that make up the value" (none above muted) + CA2/CA4 rendered amounts | proven | The sum itself is fixture arithmetic; the client only renders server values |
| CA5 | iOS | iS "getHistory_decodesTheContractDataSet_newestFirst" (decoded open effects = latestValue − recordedValue) | proven | Same remark |
| CA5 | Android | aD CA2 + CA4 + "CA6 … only Assurance" (rendered 9’420.00 and the three open effects) | proven | No dedicated sum assertion |
| CA6 | server | F "CA6: « Assurance », below the 1 November entry, no longer counts" (supersededAt = 1 Nov, others null) | proven | |
| CA6 | web | wD "CA6: mutes a movement placed under an entry and says that entry takes over" (« Déjà compris dans ta saisie du 1er novembre », only one row) | proven | |
| CA6 | iOS | iM "supersededMovement_carriesTheLegend"; ios-fr-detail-light.png (Assurance greyed, legend) | proven | |
| CA6 | Android | aD "CA6 says Assurance no longer counts, and only Assurance"; android-02 capture | proven | |
| CA7 | server | F "CA7: the history goes back to the first entry, and nothing checked before it shows"; UC "reads the movements of this asset only, since its first entry" | proven | Movement before the first entry hidden (questions.md #5) |
| CA7 | web | wD "CA3, CA7" (last row « Valeur enregistrée »), CA4 (4’800.00, 1er octobre) | proven | |
| CA7 | iOS | iS decode test (last entry 4800); ios-fr-detail-scrolled-light.png (last row 4’800.00 CHF, 1er octobre) | proven | |
| CA7 | Android | aD CA3 (last title « Valeur enregistrée ») + CA4 (4’800.00 CHF) | proven | |
| CA8 | server | F "CA8: « Restaurant » unchecked leaves the history and the value is 9 500"; SQL-H (only checked rows listed) | proven | |
| CA8 | web | wS "CA8, CA9: starts again from the new first page when the history moved" (9 500, Restaurant gone, later pages dropped); asset-api.spec "marks the asset cache stale when the budget cache version changes" (pre-existing) | proven | By composition: no single test toggles a check and watches the detail refetch |
| CA8 | iOS | Code read: `.task { await model.load() }` reruns on each appearance; iM "load_replacesWhatWasAppended" | partial | No test or capture of the return from the budget; relies on `.task` rerunning when the tab reappears |
| CA8 | Android | aD "CA8 drops an unchecked movement when the tab is shown again" (real `invalidateAfterBudgetWrite` + focus → 9’500.00, Restaurant gone) | proven | |
| CA9 | server | F "CA9: an entry of 9 000 goes on top, the value is 9 000 and the movements stay under it" | proven | |
| CA9 | web | wD "CA9: shows a new entry on top, with the earlier movements kept under it"; wD "CA12" (saveAsset with 9 000); web-after-entry-9000-mobile-light.png (9’000.00, entry on top, Salaire/Restaurant/Loyer muted below) | proven | |
| CA9 | iOS | Capture ios-fr-ca9-after-edit-light.png: 9’000.00 CHF, « Valeur enregistrée 24 novembre » on top, Salaire/Restaurant/Loyer below with « Déjà compris dans ta saisie du 24 novembre »; `editDismissed` reloads (read) | proven | Capture only |
| CA9 | Android | aD "CA9 puts a new entry on top and keeps the movements under it" | proven | android-10-ca9-entry-on-top-light-1.0.png is stale (shows the retired copy, see Gaps) |
| CA10 | server | F "CA10: the Livret holds its single entry of 10 000 and nothing else" | proven | |
| CA10 | web | wD "CA10: says nothing was checked since the only entry of the Livret" (« Tu n'as rien pointé depuis ta saisie du 1er novembre », 10’000.00), "does not say nothing was checked when movements count…"; web-livret-mobile-light.png | proven | Capture uses a demo Livret dated 15 Sept, not 1 Nov |
| CA10 | iOS | iM "nothingCheckedSince_isTheEntryDate_onlyWhenTheNewestLineIsAnEntry"; ios-fr-livret-ca10-light.png (10’000.00 CHF, « Tu n'as rien pointé depuis ta saisie du 1er novembre. ») | proven | |
| CA10 | Android | aD "CA10 says nothing was checked since the Livret's only entry", "CA10 stays silent while movements sit above the last entry"; android-09-livret-ca10-light-1.0.png | proven | |
| CA11 | server | UC "CA11: pages of 2 follow each other until nextCursor is null", "CA11: a movement checked between two pages goes on top and does not shift the next page", "CA11: a cursor past the last entry…"; H limit/cursor passed, 400 on bad cursor/limit | proven | Default page 30, max 100 |
| CA11 | web | wS "CA11: appends the next pages until the server says there are no more", "drops a second scroll while a page is on its way"; wD "CA11: waits at the end of the list for the next page…"; web-scrolled-end-mobile-light.png (Courses 1…N down to the first entry) | proven | |
| CA11 | iOS | iM "load_thenLoadMore_appendsUntilNoCursor", "loadMore_whileOneIsInFlight_isIgnored", "loadMore_fromAnOlderLoad_isDropped", "loadMore_failure_keepsTheEntriesAndFlagsIt" | proven | Trigger (`onAppear` of the last rows) read, not tested |
| CA11 | Android | aD "CA11 opens on the newest page and loads the next one going down" | proven | |
| CA12 | web | wD "CA12: « Modifier » opens the existing sheet and saves what changed"; wR "emits the chosen menu action with its asset" (pre-existing menu); web-edit-from-detail-mobile-light.png | proven | |
| CA12 | iOS | Captures ios-fr-detail-light.png (« Modifier » button), ios-fr-edit-from-detail-light.png (existing sheet); menu keeps Modifier/Archiver/Supprimer (`NetWorthAssetRow.menu`, read) | partial | No test; the open row menu is not captured |
| CA12 | Android | aD "CA12 opens the existing sheet from « Modifier »"; net-worth-default-account.spec "CA12 keeps Modifier, Archiver and Supprimer in the row's menu"; android-03-modifier-light-1.0.png | proven | |
| CA13 | server | F "CA13" ×4: debt 200, repayment 300 → −200 then purchase +100; saving paid with a debt +, Revenu on it −; debt at 0 → effect 0; asset: saving + / Revenu drawn − | proven | Exact epic example |
| CA13 | web | wD "CA13: shows a debt in amber with the effects the server kept" (+100.00, −200.00, 0.00) | proven | Renders server effects |
| CA13 | iOS | none specific | partial | Display goes through the same `AssetHistoryLine` as CA4; no debt case tested or captured |
| CA13 | Android | none specific | partial | Same: no debt case tested or captured |
| CA14 | server | F "CA14: a EUR account shows each effect in euros at today's rate, and none without a rate" (80 CHF / 0.8 = −100 EUR; null without rate); UC "CA14" ×2 | proven | |
| CA14 | web | wD "CA14: shows the effects of a EUR asset in euros, a dash when there was no rate" (−80,00 €, « — ») | proven | |
| CA14 | iOS | Code read: `AssetHistoryLine(entry, currency: asset.currency)`; iM "movementWithoutRate_hasNoAmount"; iS "getHistory_sendsTheCursor_andDecodesAMissingRate" | partial | Every line test uses `.chf`; no EUR rendering asserted |
| CA14 | Android | aD "CA14 shows each effect in the element's own currency" (−80,00 €, 5 000,00 €) | proven | |
| CA15 | server | UC "CA15: an archived / unknown or another user’s asset has no detail (404)"; H "CA15: answers 404 ERR_ASSET_NOT_FOUND…" | proven | |
| CA15 | web | wR "CA15: leaves an archived row untappable"; wD "CA15: says an archived or unknown asset is no longer available, with a way back"; web-not-found-mobile-light.png | proven | Covers the URL path too (questions.md #8) |
| CA15 | iOS | iM "load_unknownAsset_isNotFound"; archived row not wrapped in the open Button (`NetWorthAssetRow`, read) | partial | No test that an archived row is inert |
| CA15 | Android | aR "CA15 leaves an archived row inert"; aD "CA15 says an archived or unknown element is no longer there" | proven | |
| CA16 | web | wP "CA1, CA16" (navigates to `['a1']` relative to /net-worth); route `:id` in net-worth.routes.ts (read); e2e "opens the detail of a row at its own address, then edits from there" (URL `/net-worth/:id`, reload keeps the page) | partial | e2e not run here; « Précédent » (browser back) not asserted anywhere |
| CA17 | web | Capture web-detail-mobile-light.png (375 px, page fills the content area, no side panel) | proven | Capture only |
| CA18 | iOS | Push: `NetWorthTab.navigationDestination(for: NetWorthDestination)` (read); VoiceOver: iM "movement_readsNameDateAndSignedEffect" (« Salaire, Pointé le 10 novembre, +6’000.00 CHF »), "snapshot_readsRecordedValue" (« Valeur enregistrée, 1er novembre, 5’000.00 CHF »), "supersededMovement_carriesTheLegend", "movementWithoutRate_hasNoAmount" | partial | Labels proven; the back gesture is not tested; reads « Valeur enregistrée », not the contract's « Valeur saisie » (decision questions.md #2) |
| CA18 | Android | aD "CA18 reads each entry as its name, its date, its amount and the legend", "CA18 reads no amount while amounts are hidden, nor one with no rate" (TalkBack labels, back action « Retour à Mon patrimoine »); stack from dd573bc16 (tab-route.spec, tab-stacks.spec) | proven | System back not tested; same « Valeur enregistrée » decision |
| CA19 | server | F "CA19: « Courses » shows −120 under the 1 November entry and −280 above it, dated 4 November; value 9 140" (+ open sum 414 000 cents = +4 140), "CA19: a prévision that moved several times in one period shows once…" | proven | |
| CA19 | web | Row key `type:id:at` (asset-detail-page.ts:331, read) | partial | No test renders the two « Courses » rows (same id twice) |
| CA19 | iOS | iM "samePrevisionInTwoPeriods_hasTwoIdentities" | partial | Identity proven; no render of both rows |
| CA19 | Android | `keyExtractor` `${type}-${id}-${at}` (read) | partial | No test |

Server-only CAs for the clients: CA5, CA8, CA13, CA19 values are computed on the server (« Le détail ne recalcule rien »); a client verdict covers only that it renders what the server sends.

## Gaps

Ranked by impact.

1. **CA16, web: « Précédent » and reload not proven by a run.** The e2e that reloads `/net-worth/:id` exists but was not executed here, and nothing asserts browser back lands on the same element. Smallest fix: run `pnpm test:e2e -- net-worth.spec.ts` once on a free port, and add one `page.goBack()` / `page.goForward()` step to that e2e asserting `page-title` = UBS.
2. **CA8, iOS: return from the budget untested.** The refresh relies on `.task` rerunning when the Patrimoine tab reappears with the detail still pushed. Smallest fix: one capture (uncheck « Restaurant » in the budget, switch back, 9’500.00 CHF without Restaurant), or a UI test on the `UITEST_*` harness.
3. **CA19, clients: two rows with the same prévision id never rendered in a test.** Web keys by `type:id:at`, Android by `type-id-at`, iOS by identity (tested). A wrong key would drop or merge a row silently. Smallest fix: in wD and aD, render « Courses » −280 (4 Nov, open) and −120 (28 Oct, superseded by 1 Nov) with the same id and assert two rows.
4. **CA14 / CA13, iOS (and CA13 Android): no EUR or debt rendering test.** Smallest fix: one `AssetHistoryLine` test with `currency: .eur` (−100 → « −100,00 € ») and one with effect 0 / −200 on a debt; one aD case for a debt (+100, −200, 0).
5. **CA1, CA12, CA15, iOS row behaviour untested** (tap pushes the detail, archived row inert, menu still holds Modifier/Archiver/Supprimer). Read in code and partly visible in captures. Smallest fix: one capture of the open row menu, or a `NetWorthAssetRow` UI test.
6. **Stale Android capture.** android-10-ca9-entry-on-top-light-1.0.png (17:28) predates the final copy: it shows « Rien n'a été pointé depuis… » and « Avant ta saisie du …, qui fait foi », both retired (questions.md #16, #24); the catalogs and aD now hold « Tu n'as rien pointé… » / « Déjà compris dans ta saisie du… ». android-07/08 (1.3×) were taken in the same earlier batch. Smallest fix: retake android-10 (and 07/08) on the current build.
7. **CA18 wording.** Screens and screen readers say « Valeur enregistrée » where CA18 says « Valeur saisie ». Recorded decision (questions.md #2); needs the contract updated, not the code.
8. **Minor parity.** iOS prefixes movement dates with « Pointé le », web and Android show the bare date. Not a CA failure.

## Round 2 (tip 84a142f50)

Three fix commits since round 1: 5d670c2a9 (web), 1bd1aed3f (Android), 84a142f50 (iOS). `git diff --stat 3e23bcd63 HEAD -- backend-nest shared` is empty, so the backend, SQL and shared results of round 1 still hold and were not rerun.

Suites run on the current tree (HEAD 84a142f50, working tree: only `questions.md` items 30–31 and untracked shots/notes):

- Web: `cd frontend && pnpm test`: 3786 pass (267 files), +3 over round 1 (Italian « 1º » case, negative header value, CA19).
- Android: `pnpm exec jest`: 1586 pass (224 suites), +4 (CA13, CA19, Q29 archive, Q29 delete); `pnpm exec tsc --noEmit`: exit 0.
- iOS: `xcodegen generate --use-cache` then `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath .build-dd-pul377-tests CODE_SIGNING_ALLOWED=NO`: « Test run with 2777 tests in 316 suites passed », `** TEST SUCCEEDED **` (XCTest bundle: 0 executed, as before). +6 over round 1; the six new tests are in the executed log: `ca19_samePrevisionTwice_rendersBothRows`, `ca13_debtEffects_keepTheServerSigns`, `ca14_euroAsset_showsTheEffectInEuros_orADash`, suite « NetWorthAssetRow behaviour » (CA1, CA12, CA15).
- Playwright e2e: not rerun (it needs a dev server; none started). `frontend/test-results/.last-run.json` says `"status": "passed"` at 17:53, three minutes before the web commit (17:56); it does not record which specs or how many ran. The 41/41 figure is the fixing agent's.

New abbreviations: iRow = ios/PulpeTests/Features/NetWorth/NetWorthAssetRowTests.swift; eD = frontend/.../net-worth/components/entry-date.spec.ts.

### Round-1 gaps

| # | Gap | Status | Proof |
|---|---|---|---|
| 1 | CA16 web: back/forward and reload not run | partial | e2e now has `page.goBack()` → URL `/net-worth$` and hero visible, `page.goForward()` → URL `/net-worth/<ubs>` and `page-title` = UBS, then `reload()` (net-worth.spec.ts:177-186). Still no run reproduced here; only the 17:53 `.last-run.json` above |
| 2 | CA8 iOS: return from the budget | closed (capture) | ios-fr-ca8-after-uncheck-light.png (17:55): Compte courant 9’500.00 CHF (9 420 + 80), « Ta dernière saisie : 5’000.00 CHF, le 1er novembre », history Salaire +6’000.00, Loyer −1’500.00, Valeur enregistrée 5’000.00, Assurance −300.00 with the legend, Valeur enregistrée 4’800.00; no Restaurant. It shows the end state the gap asked for; one still cannot show that it was reached by switching tabs rather than reopening |
| 3 | CA19 clients: two rows with one id never rendered | closed | Web wD « CA19: shows each time a recurring prévision was checked, even with the same id » (labels Courses, Courses, Valeur enregistrée; −120.00 / −90.00 / 4’800.00). Android aD « CA19 shows « Courses » once per period, both under the same id » (−280 on 4 Nov open, −120 on 28 Oct with « Déjà compris dans ta saisie du 1er novembre », 2 rows, header 9’140.00). iOS iM `ca19_samePrevisionTwice_rendersBothRows` (2 entries with sourceId `courses`, all row ids unique). Limit: Angular `@for` and FlatList render duplicate keys anyway, so the web and Android tests would catch a dedup in the data, not a key collision; iOS checks the ids `ForEach` uses |
| 4 | CA13/CA14 iOS, CA13 Android: no debt or EUR rendering | closed | iOS `ca13_debtEffects_keepTheServerSigns` (+100, −200 with U+2212, 0), `ca14_euroAsset_showsTheEffectInEuros_orADash` (« −100,00 € », nil without rate). Android aD « CA13 shows what a debt kept » (labels « Achat, 5 novembre, +100.00 CHF », « Virement, 4 novembre, 0.00 CHF », « Remboursement, 3 novembre, −200.00 CHF ») |
| 5 | CA1/CA12/CA15 iOS row behaviour | closed, one limit | `NetWorthAssetRow` now drives the open button from `asset.opensDetail` and the menu from `asset.rowMenuEntries(offersDefault:)`; iRow asserts `[.edit, .archive, .delete]`, `[.edit, .toggleDefault, .archive, .delete]`, archived → `opensDetail == false` and `[.unarchive, .delete]`. CA1 test calls `pushOnActiveStack(.asset)` itself: the closure `open:` → `pushOnActiveStack` (NetWorthView.swift:274) is read, not exercised |
| 6 | Stale Android captures | closed | android-10 retaken 17:45: « Tu n'as rien pointé depuis ta saisie du 24 novembre. », Salaire/Restaurant/Loyer each with « Déjà compris dans ta saisie du 24 novembre », 9’000.00 CHF on top. android-07/08 retaken 17:43 in the same batch (not reopened) |
| 7 | CA18 « Valeur enregistrée » vs « Valeur saisie » | open (contract) | Unchanged by design (questions.md #2); needs the contract text updated |
| 8 | « Pointé le » parity | closed | See review finding 1 |

### Review findings

| # | Finding | Status | Proof |
|---|---|---|---|
| 1 | iOS « Pointé le » before a movement date | closed | AssetHistoryRow.swift:36 `date = day(entry.at)`; iM `movement_readsNameDateAndSignedEffect` now expects « Salaire, <date>, +6’000.00 CHF », `supersededMovement_carriesTheLegend` and the `.en` case expect the bare date: against the old line they fail. Capture ios-fr-ca8 shows « 10 novembre » alone. Remaining « Pointé le » in iOS sources: GoalThisMonthCard, GoalPlanTimelinePresentation only (questions.md #31) |
| 2 | Android not-found flash after archive/delete from the detail | closed | asset/[id].tsx: `isNotFound` now requires `!isLeaving` (update/delete pending or succeeded). The screen's `updateAsset` is used only for archive (the sheet saves edits with its own mutation), so `isSuccess` cannot hide a later real 404 after an edit. aD « Q29 goes back after archiving… » / « …after deleting… »: waits for `router.back`, asserts the history query is in `error` (the 404 refetch happened), then that « Cet élément n'est plus disponible » is absent; with `router.back` mocked the screen stays mounted, so without the guard the placeholder would render and both tests fail |
| 3 | Legend « Déjà compris… » may be literally false | kept by decision | questions.md #30 records the trade-off and the reopen condition. Not a defect to fix in this round |
| 4 | Web Italian « 1 novembre » | closed | entry-date.ts `FIRST_DAY = { fr: '1er', it: '1º' }`; eD « should write the first of the month as « 1º » in Italian » expects « 1º novembre » (old code returned « 1 novembre », the assertion it replaces) |
| 5 | Web header « -150.00 » with a hyphen | closed | Header renders `value()` = `#signed(latestValue, currency, false)`; wD « writes a negative value with the real minus sign » expects « −150.00 CHF » (U+2212, checked byte-wise) for the header and the row; the old `appCurrency` pipe produced a hyphen |

### Updated verdicts (rows changed since round 1)

| CA | Platform | Round 1 | Round 2 | Note |
|---|---|---|---|---|
| CA1 | iOS | partial | proven | iRow; tap→open closure read |
| CA4 | iOS | proven | proven | Now the bare date, same as web/Android |
| CA8 | iOS | partial | proven | Capture of the end state |
| CA12 | iOS | partial | proven | iRow menu entries |
| CA13 | iOS | partial | proven | iM ca13 |
| CA13 | Android | partial | proven | aD CA13 |
| CA14 | iOS | partial | proven | iM ca14 (« −100,00 € ») |
| CA15 | iOS | partial | proven | iRow archived row |
| CA16 | web | partial | partial | Back/forward/reload steps written; run not reproduced here |
| CA19 | web | partial | proven | wD CA19 |
| CA19 | iOS | partial | proven | iM ca19 |
| CA19 | Android | partial | proven | aD CA19 |

Every other row of the round-1 table is unchanged.

Per platform:

| Platform | Verdict | Open |
|---|---|---|
| Server | proven | none |
| Web | proven except CA16 | CA16: e2e run not reproduced (needs a dev server) |
| iOS | proven | CA18 wording (contract), back gesture untested |
| Android | proven | CA18 wording (contract), system back untested |

Still open: CA16 e2e run evidence (web); CA18 « Valeur saisie » in the contract (all clients, decision #2); finding 3 kept by decision #30.

### Round 2 addendum (tip 7dc0d196f, web)

- CA16 web closed: `pnpm exec playwright test tests/features/net-worth.spec.ts` → 3 passed (20.6 s), including « opens the detail of a row at its own address, then edits from there » with its `goBack`/`goForward`/reload steps.
- Challenge suggestion 4 fixed in 7dc0d196f: a route id that is not a uuid shows the not-found state without calling the API (asset-detail-page.spec, new test).
- Web on the final tree: `pnpm test` 267 files, 3787 passed; `pnpm run build` OK (csp-check OK).
- Challenge suggestion 3 fixed in 031d3cd6b (iOS): a reload whose first page is unchanged keeps the pages appended after it; a changed first page replaces the list. Full iOS suite on « Pulpe Tests » at 031d3cd6b: 2778 tests in 316 suites passed.

Final verdict at 031d3cd6b: every CA proven on server, web, iOS and Android. Open on the contract side only: CA18 wording « Valeur enregistrée » (decision 2) and Android in scope (decision 1).
