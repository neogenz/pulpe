# Review: Refonte UX de Mon patrimoine (web + iOS)

- Rounds: 3
- Started: 2026-11-12

## Round 1 · r-3f9a

- Date: 2026-11-12
- By: Maxime De Sogus
- Diff: `origin/main...0bc9e4d5a`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 24/32 met, 4 unmet, 4 unverified at runtime, 0 out of the diff

### Criteria

Phase 1

- [ ] The PR names the overflowing and overlapping elements, with before screenshots — the PR body only says the scrollbar is fixed at the root
- [x] `resolveAssetCategory` creates only for an unknown name — `frontend/projects/webapp/src/app/core/asset/asset-category.ts:18`
- [x] Value only → one snapshot; name only → one `PATCH`; a debt never offers « Comptes » — `frontend/projects/webapp/src/app/feature/net-worth/components/asset-form-dialog.schema.ts:118`
- Unverified at runtime: no overlap at 390px, no inner scroll at 1440px — a capture of the dialog at both widths
- [x] Lexicon passes, no removed key referenced — the four catalogs hold the same keys, none says « rapproché »

Phase 2

- [x] No empty column, « Catégories » button absent — `frontend/projects/webapp/src/app/feature/net-worth/net-worth-page.ts:194`
- [x] Row click and « Modifier » open the same sheet, header ⋮ renames a Type — `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-asset-row.ts:55`
- [x] 3 Type nodes for 25 elements; one Type and no debt → no diagram — `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-sankey.flows.ts:58`
- [ ] Web contrast ratios in light and dark, written in the PR — the PR records the iOS ratios only
- [x] Grammatical FX sentence in four languages — `frontend/projects/webapp/public/i18n/fr.json:1469`
- Unverified at runtime: e2e net-worth spec green — a Playwright run

Phase 3

- [x] A non-followed own CHF account is offered, an EUR one is not — `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-accounts-dialog.service.ts:80`
- [x] Never two snapshots per `assetId`, none for a created element, exactly one unlink — `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-account-links.ts:30`
- [x] Finishing writes exactly the plan; cancel writes nothing — `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-accounts-dialog.ts:211`
- [x] No « Dans Pulpe » in the reconciliation — `linkedHint` rewritten in the four catalogs

Phase 4

- [x] Value-only edit → snapshot only — `ios/PulpeTests/Features/NetWorth/AssetFormDraftTests.swift:109`
- [x] Name-only edit → `PATCH` only — `ios/PulpeTests/Features/NetWorth/AssetFormDraftTests.swift:109`
- [x] Untouched → close — `ios/PulpeTests/Features/NetWorth/AssetFormDraftTests.swift:102`
- [x] An overdrawn account starts with the toggle on — `ios/PulpeTests/Features/NetWorth/AssetFormDraftTests.swift:39`
- [x] A debt never offers « Comptes » — `ios/PulpeTests/Features/NetWorth/AssetFormDraftTests.swift:72`
- [x] No net-worth string says « catégorie », API errors included — `ios/Pulpe/Core/Network/APIError.swift:197`
- [x] Row tap and « Modifier » open the same sheet — `ios/Pulpe/Features/NetWorth/NetWorthAssetRow.swift:22`
- [x] The row menu has no value entry — `ios/Pulpe/Features/NetWorth/NetWorthAssetRow.swift:73`
- Unverified at runtime: `xcodebuild` green with SwiftLint strict — a build and a lint run on this head

Phase 5

- [x] 25 elements in 3 Types → 3 left nodes — `ios/PulpeTests/Features/NetWorth/NetWorthSankeyTests.swift:62`
- [x] One Type without debt → no diagram — `ios/PulpeTests/Features/NetWorth/NetWorthSankeyTests.swift:77`
- [x] Ratios in the PR — the PR 874 body lists nodes ≥ 5.86 and labels ≥ 9.05 in light and dark

Phase 6

- [x] `ReconcileAccountsSheet.swift` under 500 lines — 391 lines
- [x] A followed account is prefilled — `ios/PulpeTests/Features/CurrentMonth/ReconcileLinkedAccountsTests.swift:13`
- [ ] Picking an account sends `PATCH inPulpe:true` and a snapshot — the plan and the call order are asserted, the `inPulpe` value sent is not
- [x] « Autre compte… » with the toggle creates in « Comptes », no extra snapshot — `ios/PulpeTests/Features/CurrentMonth/ReconcileLinkedAccountsTests.swift:60`
- [x] Removing a prefilled row unlinks without a snapshot — `ios/PulpeTests/Features/CurrentMonth/ReconcileLinkedAccountsTests.swift:79`
- [x] Toggle on with an empty name cannot finish — `ios/PulpeTests/Features/CurrentMonth/ReconcileLinkedAccountsTests.swift:111`
- [x] Dismiss writes nothing — `ios/PulpeTests/Features/CurrentMonth/ReconcileLinkedAccountsTests.swift:149`
- [ ] No duplicate `assetId` in a batch — guarded at `ReconcileAccountsFlow.swift:147`, never tested with the same account on two rows
- Unverified at runtime: SwiftLint strict clean — a lint run on this head

### Findings

- `ios/Pulpe/Domain/Store/AssetStore.swift:133` : `save` takes `AssetEdit`, declared in `Features/NetWorth/AssetFormDraft.swift:4`, so Domain depends on Features → move `AssetEdit` next to `AssetCategoryChoice` — 🟡 major, architecture
- `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileAccountsSheet+AccountLink.swift:105` : « Autre compte… » is offered on a row that is already typed and erases its name and its switch → offer it only on a row holding one of my accounts — 🟡 major, frontend
- `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileAccountsSheet+AccountLink.swift:129` : on a typed row the menu is a lone chevron, about 34pt wide → widen its hit area to 44pt — 🟡 major, standards
- `ios/Pulpe/Domain/Store/AssetStore.swift:171` : the `AssetCreate` rebuild copies `:125`, fed by a `categoryId: ""` placeholder → one private create shared by both — 🟡 major, code-health
- `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-account-links.ts:46` : a row with « Ajouter à Mon patrimoine » on, a name and a blank balance passes `canContinue` then is dropped silently → a ticked row also needs a readable balance — 🟡 major, error-handling
- `ios/Pulpe/Domain/Store/AssetStore.swift:177` : a refused write after the sheet closed toasts the raw API error, and only a snapshot failure is tested → a dedicated message and a mid-sequence failure test — 🟢 minor, error-handling
- `ios/PulpeTests/Features/CurrentMonth/ReconcileLinkedAccountsTests.swift:145` : the mock records `update` without its payload, so swapping `true`/`false` stays green → record and assert `inPulpe` per id — 🟢 minor, code-health
- `ios/Pulpe/Domain/Services/AssetService.swift:13` : `deleteCategory` has no production caller left → delete it — 🟢 minor, code-health
- `ios/Pulpe/Features/NetWorth/NetWorthSections.swift:3` : the header says "no sum" while debt Types are now summed; same in `Breakdown/NetWorthSankey.swift:4` → reword both — 🟢 minor, code-health
- `ios/Pulpe/Features/NetWorth/Breakdown/NetWorthSankey.swift:49` : `build` creates a second `NetWorthSections` per render → take the sections the view already holds — 🟢 minor, performance
- `ios/Pulpe/Features/NetWorth/NetWorthView.swift:163` : the ⋮ label copies `NetWorthAssetRow.swift:84` → one shared label — 🟢 minor, rot
- `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileAccountsSheet+AccountLink.swift:129` : eighth hand-written pad / `contentShape` / negative-pad block → one `View` extension in `Shared/Extensions` — 🟢 minor, rot
- `ios/Pulpe/Features/NetWorth/RenameAssetTypeSheet.swift:57` : a new form sheet without the success haptic of the form checklist → add it — 🟢 minor, conform
- `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileAccountsFlow.swift:59` : `rowAccounts` runs parallel to the settable `accounts`; no desync path found — 🟢 minor, code-health
- `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileLinkedAccountsGate.swift:6` : three vocabularies for one concept (`Linked`, `follow`, `netWorthAccounts`) — 🟢 minor, code-health
- `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileAccountsSheet+AccountLink.swift:88` : « Retirer ce compte » on a followed account stops following it and nothing says so → name the action for what it does — 🟢 minor, fit
- `frontend/projects/webapp/src/app/feature/net-worth/net-worth-page.ts:194` : « Ce que j'ai » renders its heading over nothing for a user with only debts → guard it like « Ce que je dois » — 🟢 minor, frontend
- `frontend/projects/webapp/src/app/feature/net-worth/services/net-worth-dialog.service.ts:64` : `openRenameType` has one consumer, against `feature-dialog-services.md` → open the dialog from the page — 🟢 minor, conform
- `frontend/projects/webapp/src/app/core/asset/asset-api.ts:141` : `deleteCategory$` has no caller left → delete it, its spec case and the stale mock — 🟢 minor, code-health
- `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-groups.ts:6` : a nullable `category` forces three `!` → a non-null type for own groups — 🟢 minor, code-health
- `frontend/projects/webapp/src/app/feature/net-worth/components/asset-form-dialog.ts:43` : imports `MAX_TYPE_NAME_LENGTH` from a sibling dialog → move it to the schema — 🟢 minor, rot
- `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-account-links.ts:23` : `CENTS_PER_UNIT` declared twice in one folder → export one — 🟢 minor, rot
- `frontend/projects/webapp/src/app/feature/net-worth/components/rename-type-dialog.ts:84` : no spec for the new dialog → one small spec — 🟢 minor, standards
- `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-accounts-dialog.html:221` : a new `!important` utility on the lock icon → the existing icon size utility — 🟢 minor, conform
- `frontend/projects/webapp/src/app/feature/net-worth/components/asset-form-dialog.schema.ts:131` : a value confirmed unchanged writes no snapshot, so « Mis à jour … » cannot be refreshed without a change; as planned — 🟢 minor, fit

## Round 2 · r-7c21

- Date: 2026-11-12
- By: Maxime De Sogus
- Diff: `origin/main...35e76b1bd`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 31/32 met, 1 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

Carried from round 1, now met

- [x] The PR names the overflowing and overlapping elements — PR 874 body, « Two layout bugs fixed at the root »; the before captures stay local, the CLI cannot attach them
- [x] Web contrast ratios in light and dark, written in the PR — nodes ≥ 4.57, labels ≥ 13.24
- [x] Picking an account sends `PATCH inPulpe:true` and a snapshot — `ios/PulpeTests/Features/CurrentMonth/ReconcileLinkedAccountsTests.swift`, `service.updates` asserted per id
- [x] No duplicate `assetId` in a batch — `theSameAccountOnTwoRows_isSnapshottedOnce`
- [x] No overlap at 390px, no inner scroll at 1440px — captures of the add and edit dialogs at both widths
- [x] e2e net-worth spec green — `playwright test e2e/tests/features/net-worth.spec.ts`, 2 passed
- [x] `xcodebuild` green with SwiftLint strict — 2638 tests passed, lint clean on `35e76b1bd`

Unmet

- [ ] Toggle on cannot finish while the plan would drop the account — iOS gates the name only; a ticked, named row with a blank balance finishes and creates nothing

### Findings

- `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileAccountsFlow.swift:136` : a ticked, named row with a blank balance finishes and the account is dropped silently; the web twin got its gate in round 1 → gate on the balance too, say why on screen, one test — 🟡 major, error-handling
- `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-accounts-dialog.spec.ts:947` : the spec of the balance gate uses one row, where the total already disables the button, so deleting the gate stays green → a first valid row, then a ticked row left blank — 🟢 minor, code-health
- `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-accounts-dialog.html:169` : the button is disabled for a missing balance with no reason on screen → a hint under the balance — 🟢 minor, frontend
- `frontend/projects/webapp/src/app/feature/net-worth/services/net-worth-store.ts:106` : `recordValue(id, value)` is `saveAsset(id, { value })` written twice → one path — 🟢 minor, rot
- `frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-accounts-dialog.spec.ts:847` : nothing asserts « Ne plus suivre le compte » on a followed row → one assertion — 🟢 minor, code-health
- `frontend/projects/webapp/src/app/feature/net-worth/components/asset-form-dialog.ts:137` : the Type select shows a user-named Type outside `ph-no-capture` → the class on its form field — 🟢 minor, security
- `ios/Pulpe/Features/NetWorth/NetWorthView.swift:4` : the header says read-only for a view that edits and sums debt Types → reword — 🟢 minor, code-health
- `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-sankey.ts:62` : on a phone the shortfall label stays left of its bar; a 390px render with a negative net shows it clear of every node — 🟢 minor, frontend, no change
- `ios/Pulpe/Features/NetWorth/AssetFormSheet.swift:242` : the form still hands `createPayload` an empty `categoryId` the store overwrites; already on `main` — 🟢 minor, code-health, out of this change

## Round 3 · r-b84e

- Date: 2026-11-12
- By: Maxime De Sogus
- Diff: `35e76b1bd..9897c5b17`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 32/32 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Toggle on cannot finish while the plan would drop the account — `ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileAccountsFlow.swift:137`, pinned by `addingToMonPatrimoineWithoutABalance_cannotFinish`; the web spec goes red when its gate is removed
- [x] Runtime on `9897c5b17` — iOS 2639 tests passed and SwiftLint strict clean; web 142 specs passed, `ng build`, eslint, prettier and lexicon green

### Findings

None.
