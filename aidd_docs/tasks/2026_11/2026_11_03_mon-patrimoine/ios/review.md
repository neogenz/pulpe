# Review: Mon patrimoine (iOS)

- Rounds: 5
- Started: 2026-11-08

## Round 1 · r-7c3e

- Date: 2026-11-08
- By: Maxime De Sogus
- Diff: `e7f94c44a...2f5897f14`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 23/34 met, 4 unmet, 7 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 `Asset`/`NetWorth` Codable, Sendable, Hashable; `AssetCodableTests` pass — `ios/Pulpe/Domain/Models/Asset.swift:31-70`, full run 2609 passed
- [x] P1.2 `AssetServiceTests` assert method, path, body of the nine calls — `ios/PulpeTests/Domain/Services/AssetServiceTests.swift`, full run green
- [x] P1.3 nine French error codes; `pnpm test:lexicon` passes — `ios/Pulpe/Core/Network/APIError.swift:193-211`, codes match `shared/src/error-codes.ts:101-109`; lexicon 12/12 pass
- [x] P1.4 focused tests non-zero; `swiftlint lint --strict` passes — full run 2609 tests; swiftlint exit 0
- [x] P2.1 `PulpeApp.swift` under 500 lines — 492 lines, lint green
- [x] P2.2 `FeatureFlagsStoreTests` pass, cached value never flips back — `ios/PulpeTests/Domain/Store/FeatureFlagsStoreTests.swift:26-36`
- [x] P2.3 `AssetStoreTests` cover TTL, starter, failure refetch, dropped write, reset during load — `ios/PulpeTests/Domain/Store/AssetStoreTests.swift:11-91`
- [x] P2.4 `SessionDataResetterTests` pass; full run green — `ios/Pulpe/App/SessionDataResetting.swift:48-49`, 2609 passed
- [x] P3.1 `NetWorthSectionsTests` pass; no sum on an amount for display — `ios/Pulpe/Features/NetWorth/NetWorthSections.swift:25-43` (the layout's `reduce` over flow widths is geometry, ambiguous against the literal criterion)
- Unverified at runtime: P3.2 same totals and subtotals as the web for the same account — needs a side-by-side run
- Unverified at runtime: P3.3 flag-on row opens the page — code gates row and every load on the flag (`SavingsGoalsListView.swift:109`), no run recorded beside the plan
- [x] P3.4 build, lint and focused tests pass — full run built PulpeLocal/Local and passed
- [x] P4.1 `AssetFormDraftTests` pass — full run
- Unverified at runtime: P4.2 create/edit rows on the simulator; server error keeps the sheet open — `AssetFormSheet.swift:246-248` keeps it open; no run recorded beside the plan
- Unverified at runtime: P4.3 archive, unarchive, delete per the Test Scope — no run recorded beside the plan
- Unverified at runtime: P5.1 value row on the simulator — `AssetValueSheetTests` pass
- [x] P5.2 non-empty category delete refused with names, category stays — `AssetCategoriesSheet.swift:151-157`, `AssetCategoriesLogicTests`
- [x] P5.3 lexicon, lint, focused tests — all green
- [x] P6.1 `NetWorthSankeyTests` pass the six web cases — `NetWorthSankeyTests.swift:40-123` mirror `net-worth-sankey.flows.spec.ts` one for one
- [x] P6.2 `NetWorthSankeyLayoutTests` pass — full run
- [ ] P6.3 simulator card matches the web shape — never rendered in-app; executor reports the « Ce que j'ai » label overlapping the bands (`NetWorthBreakdownCard.swift:88-91` puts middle-column labels on the band side)
- [x] P7.1 `ReconcileLinkedAccountsTests` pass; existing suites unchanged — full run
- [x] P7.2 flag off opens as today with no asset request — `ReconcileLinkedAccountsGate.swift:15-16` returns `content([])` before any load
- [x] P7.3 completion writes one snapshot request, dismiss nothing; sheet under 500 — `ReconcileAccountsSheet+LinkedAccounts.swift:32-40`, 490 lines (wiring itself untested)
- [x] P8.1 `AssetLinkTests`, `BudgetLineTests`, `BudgetLineSpreadRequestTests` pass — full run
- [x] P8.2 picker offers compatible active assets only, absent flag off — `AssetPickerField.swift:35,63`
- [ ] P8.3 flag-off byte-identical bodies, link survives untouched edits — `EditTemplateLineSheet.swift:252` sends `assetId: null` on any edit of an income template line drawn from an asset, flag on or off; `EditTemplateLineSheetTests` not extended as projected
- [x] P8.4 lexicon, lint, sizes, full run — `AddBudgetLineSheet*` 216/191/170/141 lines, `EditTemplateLineSheet.swift` 437
- Unverified at runtime: P9.1 Appliquer and Écarter per the Test Scope — `NetWorthView.swift:184-194`
- Unverified at runtime: P9.2 pointing elsewhere then returning shows the suggestion — `.task { forceRefresh }` at `NetWorthView.swift:101`
- [x] P9.3 lexicon, lint, build — green
- [ ] P10.1 a Revenu « Tiré de mon patrimoine » is created with `assetId` — the segment only shows when `AssetStore` is already loaded (`AddBudgetLineSheet+IncomeOrigin.swift:72-74`); opened as a Revenu (`BudgetDetailsView.swift:230`), nothing loads it; never checked in-app
- [ ] P10.2 edit form shows « Pris sur <name> » read-only — `EditBudgetLineSheet.swift:397-406` hangs its only load on a `Group` that is empty until loaded; template-line edit shows nothing and clears the origin
- [x] P10.3 tests, sizes, lexicon, lint, full run — green

### Findings

- `ios/Pulpe/Features/Templates/TemplateDetails/EditTemplateLineSheet.swift:252` : an income template line drawn from an asset (created by « Chaque mois » at `AddBudgetLineSheet+Submit.swift:102`) loses its origin on any edit, because `kind.assetLink` is `nil` for income so the change reads as « cleared »; it propagates to budgets and happens with the flag off too → reuse the income guard of `EditBudgetLineSheet.assetChange` (move it beside `assetLinkChange` in `Asset.swift`) and cover it in `EditTemplateLineSheetTests` — 🟡 major, fit
- `ios/Pulpe/Features/NetWorth/AssetFormDraft.swift:69-74` : saving the edit form untouched sends `PATCH {}`, which `assetUpdateSchema`'s refine rejects with a 400; the web always sends name and category; `AssetFormDraftTests.swift:59` locks the empty payload in → disable « Enregistrer » or dismiss without a request when nothing changed — 🟡 major, error-handling
- `ios/Pulpe/Features/Budgets/BudgetDetails/AddBudgetLineSheet+IncomeOrigin.swift:72-74` : `offersAsset` reads a store nothing loads when the sheet opens on a Revenu (only the Épargne/Dépense picker loads it), so the origin is missing on a cold session → load the store from the sheet when the flag is on — 🟡 major, fit
- `ios/Pulpe/Shared/Components/EditBudgetLineSheet.swift:397-406` : `.task` on a `Group` with no child never runs, so « Pris sur » stays hidden unless another screen loaded the store (same mechanism as the documented BudgetDetailsView blank page); plausible, not run → trigger the load from the sheet's own container — 🟡 major, frontend
- `ios/Pulpe/Features/NetWorth/NetWorthView.swift:66-72` : « Catégories » only shows when loaded with a category; the web shows it always, so leftover categories after deleting every asset cannot be managed, and `AssetCategoriesSheet.swift:32-36` is unreachable → show the button in the empty state too — 🟢 minor, fit
- `ios/Pulpe/Features/NetWorth/NetWorthAssetRow.swift:62-74` : an archived row offers « Mettre à jour la valeur » and « Modifier »; the web offers only Désarchiver and Supprimer → branch the menu on `archivedAt` — 🟢 minor, fit
- `ios/Pulpe/Features/NetWorth/AssetFormDraft.swift:35,64` : create is valid with no value typed and records 0; the web requires a value → require `amount` on create — 🟢 minor, fit
- `ios/PulpeTests/Features/CurrentMonth/MovementSheetTests.swift:115-119` : asserts `SavingsOrigin.options`, never the movement sheet; `SessionDataResetterTests.swift:107-108` asserts stores that never loaded; `RecordsLinkedSnapshots` and its failure toast have no test → assert observable behaviour — 🟢 minor, code-health
- `ios/Pulpe/Domain/Store/FeatureFlagsStore.swift:49` : `isFeatureEnabled` returns `false` when diagnostic sharing is off (`AnalyticsService.swift:331`), so a user who opted out never gets the feature and its cache is overwritten; plausible, web behaviour not checked → confirm the intended rollout for opted-out users — 🟢 minor, fit

## Round 2 · r-b41d

- Date: 2026-11-08
- By: Maxime De Sogus
- Diff: `e7f94c44a...21cdef7b2`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 24/34 met, 1 unmet, 9 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 `Asset`/`NetWorth` Codable, Sendable, Hashable — `ios/Pulpe/Domain/Models/Asset.swift`; full run at 21cdef7b2: 2616 tests in 298 suites passed
- [x] P1.2 `AssetServiceTests` nine calls — full run green
- [x] P1.3 nine French error codes; lexicon — `ios/Pulpe/Core/Network/APIError.swift`, untouched by the repair
- [x] P1.4 focused tests non-zero; `swiftlint lint --strict` — 2616 tests; swiftlint exit 0 at 21cdef7b2
- [x] P2.1 `PulpeApp.swift` under 500 lines — untouched, lint green
- [x] P2.2 `FeatureFlagsStoreTests`, cached value never flips back — `FeatureFlagsStore.swift:34-35` still returns before PostHog is initialized
- [x] P2.3 `AssetStoreTests` — full run
- [x] P2.4 `SessionDataResetterTests` — `SessionDataResetterTests.swift:82-87` now loads the store and arms the flag before the reset, so the assertions at :110-111 can fail
- [x] P3.1 `NetWorthSectionsTests`, no sum for display — untouched
- Unverified at runtime: P3.2 same totals as the web for one account — needs a side-by-side run
- Unverified at runtime: P3.3 flag-on row opens the page — scratchpad v-04/v-05 show it, no run recorded beside the plan
- [x] P3.4 build, lint, focused tests — green
- [x] P4.1 `AssetFormDraftTests` — `AssetFormDraftTests.swift:28-35,68-72`
- Unverified at runtime: P4.2 create/edit on the simulator, server error keeps the sheet — v-17..v-19 in the scratchpad, not recorded beside the plan
- Unverified at runtime: P4.3 archive, unarchive, delete — v-12/v-13 in the scratchpad, not recorded beside the plan
- Unverified at runtime: P5.1 value row on the simulator — `AssetValueSheetTests` pass
- [x] P5.2 non-empty category delete refused — `AssetCategoriesLogicTests`
- [x] P5.3 lexicon, lint, focused tests — green
- [x] P6.1 `NetWorthSankeyTests` six web cases — full run
- [x] P6.2 `NetWorthSankeyLayoutTests` — full run
- [ ] P6.3 simulator card matches the web shape — the three-column case reads clear (v-06/v-07), but a middle-column label sits 16pt above its node while nodes are 14pt apart (`NetWorthBreakdownCard.swift:99`, `DesignTokens+Chart.swift:58`), so with a category column of two or more categories each lower label covers the node above
- [x] P7.1 `ReconcileLinkedAccountsTests` — `ReconcileLinkedAccountsTests.swift:60-89` now drive `recordLinkedSnapshots`
- [x] P7.2 flag off opens as today — `ReconcileLinkedAccountsGate.swift:15-16`, untouched
- [x] P7.3 completion writes one snapshot request, dismiss nothing — `ReconcileAccountsSheet+LinkedAccounts.swift:39-46`, tests :60-79
- [x] P8.1 `AssetLinkTests`, `BudgetLineTests`, `BudgetLineSpreadRequestTests` — full run
- [x] P8.2 picker compatible active assets only, absent flag off — `AssetPickerField.swift`, untouched
- [x] P8.3 flag-off byte-identical bodies, link survives untouched edits — `EditTemplateLineSheet.swift:252` now goes through `lineAssetChange` (`Asset.swift:139-144`), which sends no key while an income stays an income; `EditTemplateLineSheetTests.swift:329-334` returns `.some(nil)` on the pre-fix code
- [x] P8.4 lexicon, lint, sizes, full run — `EditTemplateLineSheet.swift` 441, `EditBudgetLineSheet.swift` 436, `AddBudgetLineSheet.swift` 217 lines
- Unverified at runtime: P9.1 Appliquer and Écarter — v-31 in the scratchpad, not recorded beside the plan
- Unverified at runtime: P9.2 pointing elsewhere then returning — v-30/v-31 in the scratchpad, not recorded beside the plan
- [x] P9.3 lexicon, lint, build — green
- Unverified at runtime: P10.1 a Revenu « Tiré de mon patrimoine » created with `assetId` — `AddBudgetLineSheet.swift:180` now loads the store; v-22..v-29 show it, but Mon patrimoine was opened first (v-05), so the cold path was not exercised
- Unverified at runtime: P10.2 edit form shows « Pris sur <name> » — `EditBudgetLineSheet.swift:397` is a `VStack`, so its `.task` runs; v-34 shows it on a warm store only
- [x] P10.3 tests, sizes, lexicon, lint, full run — green

### Round 1 findings

- Resolved: template-line income loses its origin — `EditTemplateLineSheet.swift:252`, test :329-334
- Resolved: empty PATCH on an untouched edit — `AssetFormSheet.swift:235` dismisses when `hasChanges` is false (`AssetFormDraft.swift:80-82`)
- Resolved: Revenu origin missing on a cold store — `AddBudgetLineSheet.swift:180`
- Resolved: « Pris sur » never loads — `EditBudgetLineSheet.swift:397` (`Group` replaced by `VStack`); see the new minor below
- Resolved: « Catégories » hidden on the empty screen — `NetWorthView.swift:67`
- Resolved: archived row offers value update and edit — `NetWorthAssetRow.swift:63`
- Resolved: create valid without a value — `AssetFormDraft.swift:38`
- Resolved: tests asserting nothing observable — `MovementSheetTests` case moved and renamed to what it asserts (`AddBudgetLineIncomeOriginTests.swift:17-21`), resetter test arms its stores, snapshot recording covered
- Resolved: flags off for opted-out users — `AnalyticsService.swift:332-347` mirrors web fd9dd7040; SDK 3.93.6 drops `$feature_flag_called` while opted out (`PostHogSDK.swift:1591-1597`, `captureInternal` returns on `isOptOutState`), `identify`/`setPersonProperties` stay gated on `isEventCapturingEnabled` (`AnalyticsService.swift:254,277`), and the SDK already requests `/flags` for the anonymous id on setup and `reset()` regardless of opt-out

### Findings

- `ios/Pulpe/Features/NetWorth/Breakdown/NetWorthBreakdownCard.swift:93-99` : a middle-column label is a two-line `caption2` pill (about 26pt) centred 16pt above its node, while nodes in a column are 14pt apart; the 40pt headroom only clears the top node, so as soon as a category holds two assets and there are two categories, the second category's pill covers the bottom of the first node and the bands there (v-06/v-07 only show the single-node case) → place middle labels inside the gap only when it fits, else beside the node on the side with fewer bands, or raise `sankeyNodeGap` to the pill height for the category column; check a two-category account on the simulator — 🟡 major, frontend
- `ios/Pulpe/Shared/Components/EditBudgetLineSheet.swift:397-406` : now that the container always renders, its `.task` runs with the flag off, so editing an income that carries an `assetId` fires `GET /v1/assets` and leaves an empty stack that still takes the sheet's spacing; the spec wants flag-off flows unchanged → gate the load like `AddBudgetLineSheet.loadAssets(flagOn:store:)` and render the card only when the flag is on — 🟢 minor, fit
- `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:280` : the only flag assertion while opted out passes before and after the change; no test locks "flags still evaluate with diagnostics off" (the web added one in `posthog.spec.ts`), and the new view wiring (`AddBudgetLineSheet.swift:180`, `AssetFormSheet.swift:235`) can be removed with every test green → assert the opted-out reload reaches PostHog, or accept the wiring as covered by the simulator pass — 🟢 minor, code-health

## Round 3 · r-0c35

- Date: 2026-11-08
- By: Maxime De Sogus
- Diff: `e7f94c44a...ce9c0fcf2`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 24/34 met, 1 unmet, 9 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 `Asset`/`NetWorth` Codable, Sendable, Hashable — `ios/Pulpe/Domain/Models/Asset.swift`; run `Test-PulpeLocal-2026.11.08_20-54-06` (started after the last edit of every file in ce9c0fcf2, 20:54:04): 2618 passed, 1 skipped, 0 failed
- [x] P1.2 `AssetServiceTests` nine calls — same run
- [x] P1.3 nine French error codes; lexicon — `ios/Pulpe/Core/Network/APIError.swift`, untouched since round 2
- [x] P1.4 focused tests non-zero; `swiftlint lint --strict` — swiftlint exit 0 at ce9c0fcf2
- [x] P2.1 `PulpeApp.swift` under 500 lines — untouched
- [x] P2.2 `FeatureFlagsStoreTests`, cached value never flips back — `FeatureFlagsStore.swift` untouched; same run
- [x] P2.3 `AssetStoreTests` — same run
- [x] P2.4 `SessionDataResetterTests` — same run
- [x] P3.1 `NetWorthSectionsTests`, no sum for display — untouched
- Unverified at runtime: P3.2 same totals as the web for one account — needs a side-by-side run
- Unverified at runtime: P3.3 flag-on row opens the page — scratchpad screenshots only, nothing recorded beside the plan
- [x] P3.4 build, lint, focused tests — the run built PulpeLocal/Local
- [x] P4.1 `AssetFormDraftTests` — `AssetFormDraftTests.swift:77-85` locks the save decision (`AssetFormDraft.swift:84-90`) that `AssetFormSheet.swift:234` now switches on
- Unverified at runtime: P4.2 create/edit on the simulator, server error keeps the sheet — not recorded beside the plan
- Unverified at runtime: P4.3 archive, unarchive, delete — not recorded beside the plan
- Unverified at runtime: P5.1 value row on the simulator — `AssetValueSheetTests` pass
- [x] P5.2 non-empty category delete refused — `AssetCategoriesLogicTests`; the sheet is now reached from `NetWorthView.swift:103,146` on both the empty and the loaded screen
- [x] P5.3 lexicon, lint, focused tests — « Gérer les catégories » added to `Localizable.xcstrings` with de/en/it
- [x] P6.1 `NetWorthSankeyTests` six web cases — same run
- [x] P6.2 `NetWorthSankeyLayoutTests` — `NetWorthSankeyLayoutTests.swift:61-94` would fail with the old 14pt gap (pill rect 32pt tall in a 14pt gap)
- [ ] P6.3 simulator card matches the web shape — two categories now read clear (r2-a-diagram), but the middle-column gap grew to 36pt (`NetWorthSankeyLayout.swift:54-56`) inside a fixed 220pt drawing height (`DesignTokens+Chart.swift:56,61`): from 6 categories in the category column, gaps plus 8pt minimum nodes exceed it (6 → 228pt, 7 → 272pt), the 12-pass shrink at :146 cannot fix gaps and only thins every band (×0.65), and at 7 the top pill lands 58pt above the frame and the bottom nodes 26pt below, clipped by the horizontal `ScrollView`; six starter names are offered and categories are free → size the diagram height from the tallest column (layout returns its needed height, the card frames `max(sankeyHeight, needed)`), and add a 7-category case asserting every node and pill stays inside the frame
- [x] P7.1 `ReconcileLinkedAccountsTests` — same run
- [x] P7.2 flag off opens as today — `ReconcileLinkedAccountsGate.swift` untouched
- [x] P7.3 completion writes one snapshot request, dismiss nothing — untouched, tests in the run
- [x] P8.1 `AssetLinkTests`, `BudgetLineTests`, `BudgetLineSpreadRequestTests` — same run
- [x] P8.2 picker compatible active assets only, absent flag off — `AssetPickerField.swift`, untouched
- [x] P8.3 flag-off byte-identical bodies, link survives untouched edits — `EditBudgetLineSheet.swift:395` now builds the card and its `.task` only with the flag on, so flag off sends no `GET /v1/assets`; `EditTemplateLineSheetTests` in the run
- [x] P8.4 lexicon, lint, sizes, full run — lint exit 0 (500-line ceiling enforced)
- Unverified at runtime: P9.1 Appliquer and Écarter — not recorded beside the plan
- Unverified at runtime: P9.2 pointing elsewhere then returning — not recorded beside the plan
- Unverified at runtime: P10.1 a Revenu « Tiré de mon patrimoine » with `assetId` — r2-b-cold-segment shows the segment on a cold launch, not recorded beside the plan
- Unverified at runtime: P10.2 edit form shows « Pris sur <name> » — r2-b-edit-card (cold launch) shows it, r2-c-flag-off-edit shows no card flag off; not recorded beside the plan
- [x] P10.3 tests, sizes, lexicon, lint, full run — green

### Round 2 findings

- Partly resolved: middle labels covering nodes — clear for up to five categories (`NetWorthSankeyLayout.swift:54-82`, test :61-94, r2-a-diagram); the fixed height now overflows from six, see P6.3
- Resolved: asset card loading with the flag off — `EditBudgetLineSheet.swift:395`
- Partly resolved: untested wiring — the save decision is tested (`AssetFormDraftTests.swift:77-85`); the flag test only exercises a helper that ignores one of its two inputs, see below

### Findings

- `ios/Pulpe/Core/Analytics/AnalyticsService.swift:329` : `evaluatesFlags(isInitialized:isDiagnosticSharingEnabled:)` returns `isInitialized` and never reads its second parameter; `AnalyticsServiceTests.swift:295-299` asserts that a parameter is ignored, and a gate re-added inside `isFeatureEnabled` itself would keep it green → drop the helper, its parameter and the test, keeping `guard isInitialized` (the SDK behaviour is the real guarantee), or test `isFeatureEnabled` on a service built with diagnostics off — 🟢 minor, rot
- `ios/Pulpe/Features/NetWorth/AssetFormSheet.swift:234-242` : switching on `(submission, asset)` with `default:` sends an impossible `(.update, nil)` to `create` silently → let `Submission.update` carry the asset (`case update(Asset)`) and switch on the submission alone — 🟢 minor, code-health
- `ios/Pulpe/Features/NetWorth/NetWorthView.swift:101` : the closing `)` of `PulpeEmptyState(` sits four spaces left of its call → re-indent — 🟢 minor, standards

## Round 4 · r-9dc4

- Date: 2026-11-08
- By: Maxime De Sogus
- Diff: `e7f94c44a...42bbf5f60`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 24/34 met, 0 unmet, 10 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 `Asset`/`NetWorth` Codable, Sendable, Hashable — `ios/Pulpe/Domain/Models/Asset.swift`, untouched by 42bbf5f60; run `Test-PulpeLocal-2026.11.08_21-30-37` (started after the last edit of every file in 42bbf5f60, 21:25:21): 2619 tests, 2618 passed, 1 skipped, 0 failed
- [x] P1.2 `AssetServiceTests` nine calls — same run
- [x] P1.3 nine French error codes; lexicon — `ios/Pulpe/Core/Network/APIError.swift`, untouched
- [x] P1.4 focused tests non-zero; `swiftlint lint --strict` — caller-reported lint exit 0 at 42bbf5f60; focused tests in the run
- [x] P2.1 `PulpeApp.swift` under 500 lines — untouched
- [x] P2.2 `FeatureFlagsStoreTests`, cached value never flips back — `AnalyticsService.swift:333` keeps the same gate (`guard isInitialized`), the helper is gone; same run
- [x] P2.3 `AssetStoreTests` — same run
- [x] P2.4 `SessionDataResetterTests` — same run
- [x] P3.1 `NetWorthSectionsTests`, no sum for display — untouched
- Unverified at runtime: P3.2 same totals as the web for one account — needs a side-by-side run
- Unverified at runtime: P3.3 flag-on row opens the page — scratchpad screenshots only, nothing recorded beside the plan
- [x] P3.4 build, lint, focused tests — the run built PulpeLocal/Local
- [x] P4.1 `AssetFormDraftTests` — `AssetFormDraftTests.swift:83` asserts `.update(original)`; `AssetFormSheet.swift:234-246` switches on the submission alone
- Unverified at runtime: P4.2 create/edit on the simulator, server error keeps the sheet — not recorded beside the plan
- Unverified at runtime: P4.3 archive, unarchive, delete — not recorded beside the plan
- Unverified at runtime: P5.1 value row on the simulator — `AssetValueSheetTests` pass
- [x] P5.2 non-empty category delete refused — `AssetCategoriesLogicTests`; the sheet reached from both NetWorthView states
- [x] P5.3 lexicon, lint, focused tests — caller-reported lexicon green
- [x] P6.1 `NetWorthSankeyTests` six web cases — same run
- [x] P6.2 `NetWorthSankeyLayoutTests` — same run, `sevenCategoriesStayInsideTheReturnedFrameWithClearLabels` and `nodeHeightsAreProportionalToTheirFlow` passed
- Unverified at runtime: P6.3 simulator card matches the web shape — the clipping gap of round 3 is closed in code (`NetWorthSankeyLayout.swift:36-45,62`, `NetWorthBreakdownCard.swift:14-17`); the plan's account (two own assets) reads proportional in the scratchpad shot r3-a-demo2, not recorded beside the plan; past six nodes in a column the shape departs from the web, see Findings
- [x] P7.1 `ReconcileLinkedAccountsTests` — same run
- [x] P7.2 flag off opens as today — `ReconcileLinkedAccountsGate.swift` untouched
- [x] P7.3 completion writes one snapshot request, dismiss nothing — untouched, tests in the run
- [x] P8.1 `AssetLinkTests`, `BudgetLineTests`, `BudgetLineSpreadRequestTests` — same run
- [x] P8.2 picker compatible active assets only, absent flag off — `AssetPickerField.swift`, untouched
- [x] P8.3 flag-off byte-identical bodies, link survives untouched edits — `EditBudgetLineSheet.swift` untouched since round 3; tests in the run
- [x] P8.4 lexicon, lint, sizes, full run — green
- Unverified at runtime: P9.1 Appliquer and Écarter — not recorded beside the plan
- Unverified at runtime: P9.2 pointing elsewhere then returning — not recorded beside the plan
- Unverified at runtime: P10.1 a Revenu « Tiré de mon patrimoine » with `assetId` — not recorded beside the plan
- Unverified at runtime: P10.2 edit form shows « Pris sur <name> » — not recorded beside the plan
- [x] P10.3 tests, sizes, lexicon, lint, full run — green

### Round 3 findings

- Resolved: P6.3 diagram clipped from six categories — the layout grows to `requiredHeight` and the card frames `max(sankeyHeight, required + headroom)`; the seven-category test asserts every node and pill inside the returned frame
- Resolved: `evaluatesFlags` helper and its test — removed, `git grep evaluatesFlags -- ios` empty
- Resolved: `(.update, nil)` reaching `create` — `Submission.update(Asset)`, exhaustive switch
- Resolved: `NetWorthView.swift:101` indentation

### Findings

- `ios/Pulpe/Features/NetWorth/Breakdown/NetWorthSankeyLayout.swift:62` : the grown height equals the tallest column's bare minimum (n × 20pt + gaps), so that column has zero slack and the bisection settles on `scale = sankeyMinNodeHeight / its largest node`: every node of that column is drawn at 20pt whatever its value. With the minimum raised 8→20 this starts at seven nodes in a column (7 × 20 + 6 × 14 = 224 > 220), five in the category column. r3-a-diagram shows it: Compte UBS 12'000 and R3 Avoir 11 1'000 are the same bar, Comptes 12'000 and R3 Cat 1 3'000 too, and « Ce que j'ai » 26'743 is about 44pt in a 326pt drawing; only band thickness still carries the proportions. The web keeps proportional nodes (chartjs-sankey, `nodePadding: 14`), and phase 6 task 2 asks for node height proportional to the flow over the column scale. The 20pt floor itself is needed (two caption2 lines beside a node need about a 30pt pitch) → when growing, keep room above the minimum, e.g. `max(asked.height, requiredHeight + DesignTokens.Chart.sankeyHeight / 2)` behind a named token, and add a case asserting the largest and smallest node of a grown column differ; tradeoff: a taller card — 🟡 major, fit
- `ios/Pulpe/Features/NetWorth/Breakdown/NetWorthBreakdownCard.swift:14-17` : the growth rule lives twice, here and in `NetWorthSankeyLayout.swift:62`; `Result.height` is read only by the test (`NetWorthSankeyLayoutTests.swift:116-121`), so the test checks the layout's height and not the frame the card draws in, and `#expect(result.height >= requiredHeight)` is true by construction → keep the growth in one place (the card passes `max(token, required)` and the layout drops its own `max` and `Result.height`, the test asserting against `requiredHeight`), or the card frames from `Result.height` — 🟢 minor, rot
- `ios/Pulpe/Features/NetWorth/Breakdown/NetWorthBreakdownCard.swift:13` : « grown when many categories need more room » — any column grows it, and in r3-a-diagram the ten assets (326pt) drive it, not the six categories (300pt) → « grown when a column needs more room » — 🟢 minor, standards

## Round 5 · r-4cb0

- Date: 2026-11-08
- By: Maxime De Sogus
- Diff: `e7f94c44a...6884e0f7a`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 24/34 met, 0 unmet, 10 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 `Asset`/`NetWorth` Codable, Sendable, Hashable — `ios/Pulpe/Domain/Models/Asset.swift`, untouched by 6884e0f7a; run `Test-PulpeLocal-2026.11.08_21-44-03` on « Pulpe Tests » (started after the last edit of every file in 6884e0f7a, 21:40:11): 2619 tests in 298 suites passed, TEST SUCCEEDED
- [x] P1.2 `AssetServiceTests` nine calls — same run
- [x] P1.3 nine French error codes; lexicon — `ios/Pulpe/Core/Network/APIError.swift`, untouched
- [x] P1.4 focused tests non-zero; `swiftlint lint --strict` — swiftlint exit 0 at 6884e0f7a, no violation printed
- [x] P2.1 `PulpeApp.swift` under 500 lines — untouched
- [x] P2.2 `FeatureFlagsStoreTests`, cached value never flips back — untouched; same run
- [x] P2.3 `AssetStoreTests` — same run
- [x] P2.4 `SessionDataResetterTests` — same run
- [x] P3.1 `NetWorthSectionsTests`, no sum for display — untouched
- Unverified at runtime: P3.2 same totals as the web for one account — needs a side-by-side run
- Unverified at runtime: P3.3 flag-on row opens the page — seen this round (flag forced through the simulator defaults, removed afterwards), not recorded beside the plan as a run
- [x] P3.4 build, lint, focused tests — the run built PulpeLocal/Local
- [x] P4.1 `AssetFormDraftTests` — untouched; same run
- Unverified at runtime: P4.2 create/edit on the simulator, server error keeps the sheet — five creates succeeded this round; the server error path was not exercised
- Unverified at runtime: P4.3 archive, unarchive, delete — five deletes with the confirmation succeeded this round; archive/unarchive not exercised
- Unverified at runtime: P5.1 value row on the simulator — `AssetValueSheetTests` pass
- [x] P5.2 non-empty category delete refused — `AssetCategoriesLogicTests`, untouched
- [x] P5.3 lexicon, lint, focused tests — no copy changed
- [x] P6.1 `NetWorthSankeyTests` six web cases — same run
- [x] P6.2 `NetWorthSankeyLayoutTests` — `NetWorthSankeyLayoutTests.swift:121-123` asserts the grown frame and largest > 1.5 × smallest in column 0; with `sankeyProportionalRoom` at 0 the whole column sits on the 20pt floor (ratio 1), so the case discriminates the fix; passed in the run
- Unverified at runtime: P6.3 simulator card matches the web shape — iOS side observed on 6884e0f7a: demo account (UBS 12 000 CHF, Livret 3 000 EUR, Leasing 8 000 CHF) draws column 0 at 167.7pt and 38.3pt (12 000 / 2 742.90 = 4.38, measured 4.38) inside the unchanged 220pt drawing height; with five temporary Comptes assets (50 000, 20 000, 5 000, 200, 100 CHF) column 0 grows to 354pt (7 × 20 + 6 × 14 + 130), 50 000 / 20 000 / 12 000 measure 115.7 / 46.3 / 27.7pt (ratios 2.50 and 4.18, expected 2.50 and 4.17), 5 000, 200, 100 and Livret sit on the 20pt floor, every node and pill inside the card; the web side was not run side by side
- [x] P7.1 `ReconcileLinkedAccountsTests` — same run
- [x] P7.2 flag off opens as today — `ReconcileLinkedAccountsGate.swift` untouched
- [x] P7.3 completion writes one snapshot request, dismiss nothing — untouched, tests in the run
- [x] P8.1 `AssetLinkTests`, `BudgetLineTests`, `BudgetLineSpreadRequestTests` — same run
- [x] P8.2 picker compatible active assets only, absent flag off — `AssetPickerField.swift`, untouched
- [x] P8.3 flag-off byte-identical bodies, link survives untouched edits — `EditBudgetLineSheet.swift` untouched; tests in the run
- [x] P8.4 lexicon, lint, sizes, full run — green; `NetWorthSankeyLayout.swift` 241 lines
- Unverified at runtime: P9.1 Appliquer and Écarter — not recorded beside the plan
- Unverified at runtime: P9.2 pointing elsewhere then returning — not recorded beside the plan
- [x] P9.3 lexicon, lint, build — `pnpm test:lexicon` 12 pass 0 fail at 6884e0f7a; swiftlint exit 0; the run built PulpeLocal/Local
- Unverified at runtime: P10.1 a Revenu « Tiré de mon patrimoine » with `assetId` — not recorded beside the plan
- Unverified at runtime: P10.2 edit form shows « Pris sur <name> » — not recorded beside the plan
- [x] P10.3 tests, sizes, lexicon, lint, full run — green

### Round 4 findings

- Resolved: grown column drawn on the 20pt floor — `NetWorthSankeyLayout.swift:44-47` adds `DesignTokens.Chart.sankeyProportionalRoom` (130, `DesignTokens+Chart.swift:60-62`) to the floors; measured on the simulator above, and the seven-category test asserts the spread
- Resolved: growth rule in two places — the only rule is `NetWorthSankeyLayout.drawingHeight(_:)` (`:34-36`), `requiredHeight` is private, `Result.height` and the layout's own `max` are gone; the card frames `drawingHeight + headroom` (`NetWorthBreakdownCard.swift:14-16,56`) and the test builds its frame from the same function
- Resolved: card comment — « grown when any column needs more room » (`NetWorthBreakdownCard.swift:13`)
