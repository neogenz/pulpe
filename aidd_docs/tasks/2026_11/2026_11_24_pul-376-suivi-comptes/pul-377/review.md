# Review: PUL-377 — la valeur d'un élément suit ce que je pointe

## Round 1

- Diff: `origin/main...722c72523` (HEAD = origin/main, all work uncommitted)
- Uncommitted changes: yes
- Axes: code, functional, relevancy
- Verdict: changes-requested, because two major findings: iOS still promises a proposal the product no longer makes, and the « Modifier » reminder can show the last entry with the wrong sign

### Criteria

- [x] CA1 Épargne pointée → Livret 10 500, brute 10 500, nette 2 500 — `backend-nest/src/modules/asset/domain/asset.formulas.ts:61`, `asset.formulas.spec.ts:258`
- [x] CA2 Mensualité → Leasing 7 700, nette 2 300 — `asset.formulas.spec.ts:268`
- [x] CA3 Retrait → Livret 9 000 — `asset.formulas.spec.ts:277`
- [x] CA4 dépointer → retour à 10 000 (calcul à la lecture, aucune écriture) — `asset.formulas.spec.ts:283`
- [x] CA5 nouvelle saisie = valeur, puis +200 — cutoff `asset.formulas.ts:101`, repository `supabase-asset.repository.ts:213`, `asset.formulas.spec.ts:290`
- [x] CA6 dette bornée à 0 — `asset.formulas.ts:147`, `asset.formulas.spec.ts:302`
- [x] CA7 totaux, sous-totaux, Sankey sur la valeur à jour — `asset.formulas.ts:66-77` (`convertedValue` vient de la valeur à jour), `asset.formulas.spec.ts:320`
- [x] CA8 plus de « Je propose / Appliquer / Écarter » sur un élément — web `net-worth-asset-row.ts` (bloc retiré, test `net-worth-asset-row.spec.ts` « never offers a proposal »), iOS `NetWorthSuggestionRow.swift` supprimé
- [x] CA9 delta signé + date de saisie, absent sinon — web `net-worth-asset-row.ts:258`, iOS `NetWorthSections.swift:140-165`, tests des deux côtés
- [x] CA10 « Modifier » prérempli à 10 500 + rappel 10 000 et date — web `asset-form-dialog.ts:277-288,349`, iOS `AssetFormDraft.swift:23`, `NetWorthSections.swift:168`, tests `asset-form-dialog.spec.ts`, `AssetFormDraftTests.swift`
- [x] CA11 pointer n'écrit aucune photo — aucun chemin de pointage ne touche `asset_snapshot`; seule `recordSnapshots`/reconciliation écrit
- [x] CA12 web: invalidation `['assets']` sur mutation budget — `asset-api.ts:54`, test `asset-api.spec.ts`
- [x] CA13 indication du rapprochement avec la valeur à jour — web `reconcile-accounts-step.ts:222-240`, iOS `ReconcileAccountsSheet+AccountLink.swift:107`, tests des deux côtés
- [x] CA14 conversion au taux, sans taux → dernière saisie + incomplete — `asset.formulas.ts:55-58,141-146`, `asset.formulas.spec.ts:354,366`
- [x] CA15 archivé garde la dernière saisie — `asset.formulas.ts:137`, `asset.formulas.spec.ts:375`
- [x] CA16 une proposition en attente devient la valeur — conséquence directe du cutoff = dernière photo (`asset.formulas.ts:101`)
- [x] CA17 écartement converti, puis +200 compte — migration `20261124120000_asset_value_follows_checked_lines.sql:51-56`, trigger `:22-49`, test `supabase/tests/asset_dismissed_suggestion_conversion.sql`
- [x] CA18 apps installées: `latestValue` porte la valeur à jour, `suggestion: null`, dismiss no-op — `asset.mapper.ts:52-58`, `dismiss-asset-suggestion.use-case.ts:25-34`, tests `dismiss-asset-suggestion.use-case.spec.ts`, `shared/src/asset-schema.spec.ts`
- Unverified at runtime: CA12 iOS (relies on the existing `.task { forceRefresh }` in `NetWorthView.swift:113`) — revisit the tab after checking a line on a device
- Unverified at runtime: CA17 on a real database and under the `authenticated` role — run the SQL test and a dismissal through the old backend
- Unverified at runtime: CA18 on a real iOS 1.14.x / Android build — tap « Écarter » after CA1

### Assumptions

- Linked line amounts are in the base currency — holds (unchanged from the suggestion code), `get-net-worth.use-case.ts:68`, `asset.formulas.ts:28`
- A trigger function fires without `EXECUTE` for the caller once `REVOKE`d — holds (PostgreSQL checks it only at `CREATE TRIGGER`; same pattern already in production), `20261105100000_stamp_asset_dismissal_with_db_clock.sql:25`
- The trigger's insert passes snapshot RLS for the owner — holds, policy `auth.uid() = user_id` and `NEW.user_id` is the owner, `20261103120000_create_net_worth_tables.sql:110`
- The stamp `BEFORE` trigger rewrites the dismissal to `now()` before the copy reads it — holds, `AFTER` trigger sees the stamped `NEW`
- Supabase-js drops `undefined` keys, so the new backend never fires the trigger — holds, `supabase-asset.repository.ts` no longer maps `suggestion_dismissed_at`
- Installed clients ignore `recordedValue` and accept `suggestion: null` — holds, old `Asset.swift` has `suggestion: AssetSuggestion?`, Zod `z.object` strips extras

### Findings

- `ios/Pulpe/Shared/Components/AssetPickerField.swift:40,47`, `ios/Pulpe/Features/NetWorth/Intro/NetWorthIntroSheet.swift:91`, `ios/Pulpe/Features/NetWorth/Intro/NetWorthIntroScene.swift:341` : iOS still says « je te propose de baisser la valeur de … », « je te propose de baisser ce qu'il reste dû … », « je te propose de l'ajouter ici », « → je te propose +… ici » while there is no proposal any more. The web changed the same four texts (`fr.json` `netWorth.link.drawnHint/oweHint`, `netWorth.intro…body`, `budgetHint`), so web and iOS now describe two different products; on iOS the user is told to expect a proposal that never comes. Proof: web keys updated in `frontend/projects/webapp/public/i18n/fr.json` (`oweHint`, `drawnHint`, `body`, `budgetHint`), iOS strings unchanged and still in `Localizable.xcstrings:21134,46930,47062,47194` → reuse the web wording on iOS (« Une fois pointé, il baisse la valeur de … », « Une fois pointée, elle baisse ce qu'il reste dû sur … », « … quand tu pointes de l'argent mis de côté dans ton budget, je l'ajoute ici. », « … mis de côté et pointé dans ton budget → +… ici. ») with their de/en/it entries, and drop the four old keys — 🟡 major
- `frontend/projects/webapp/src/app/feature/net-worth/components/asset-form-dialog.ts:282` and `ios/Pulpe/Features/NetWorth/NetWorthSections.swift:172` : the reminder shows `|recordedValue|` and relies on « the overdraft box carries the sign », but the box now follows `latestValue` (`asset-form-dialog.ts:350`, `AssetFormDraft.swift:24`). When checked lines flip the sign since the entry, the reminder states the wrong entry. Repro: own Livret entered at 400, Retrait 1 000 « Tiré de » checked (the formula case `asset.formulas.spec.ts:311`) → value −600, « Modifier » opens with « Découvert » ticked and « Ta dernière saisie : 400.00 CHF », which reads as −400. Expected: « 400.00 CHF ». The reverse (entry −200, Épargne 500) shows « 200.00 CHF » with the box unticked → reads +200 → format the signed `recordedValue` (drop `Math.abs` / `.magnitude`), since the field no longer holds the entry the sign used to come from — 🟡 major
- `docs/BUSINESS_RULES.md:69` : still says a Revenu tiré « baisse la valeur proposée de cet élément », contradicting the new lines 70-74 of the same section → « il baisse la valeur de cet élément » — 🟢 minor
- `backend-nest/src/modules/asset/asset.module.ts:47` : `createInfoLoggerProvider(DismissAssetSuggestionUseCase.name)` is now unused (the use case no longer injects a logger) → delete the line — 🟢 minor
- `backend-nest/src/modules/budget-line/application/create-budget-line.use-case.ts:63` : comment still explains `checkedAt` by the « patrimoine suggestion cutoff »; the server clock now dates the cutoff of the value itself → reword to « the asset value cutoff » — 🟢 minor
- Web/iOS formatting parity on CA9/CA10 (same numbers, different text): web edit reminder uses `longDate` (« le 3 novembre 2026 », `asset-form-dialog.ts:286`), iOS `dayMonthLabel` (« le 3 novembre », no year even for an older year, `NetWorthSections.swift:170`); the web row adds the year for an earlier year (`net-worth-asset-row.ts:274`), iOS never does; web signs a drop with U+2212 « − » (`net-worth-asset-row.ts:265`), iOS with the locale's hyphen via `asCurrency` (`Decimal+Extensions.swift:105`) → pick one rule (year when not the current year, one minus glyph) and apply it on both sides — 🟢 minor

### Limits

- Debt order by `checkedAt` (`asset.formulas.ts:142`) has no test that could fail: today only a Dépense moves a debt and always downward, so clamping per step equals clamping once at the end. The rule only becomes observable with PUL-378 (a movement that raises a debt) — add the epic's « 200, −300, +100 → 100 » test then.
- `ReconcileLinkedAccountsGate.swift:27` now forces a network fetch on every opening: a spinner each time, and a transient failure now drops the linked rows (`hasError` → `nil`) where the cached assets used to serve. Needed for CA13 freshness on iOS unless budget mutations invalidate `AssetStore`; a device run would show whether the delay is noticeable.
- New web bundle against the old backend during the deploy window: `assetSchema.recordedValue` is required, so `GET /v1/assets` would fail to parse until Railway serves the new backend (flagged users only, a few minutes). Settled by checking whether Vercel can go live before Railway in `production-finalize.yml`.
- An asset unarchived after lines were checked while archived takes them all at once (cutoff = last entry). No criterion covers it; a product call.
- The SQL test re-types the migration's conversion query instead of exercising the migration, and runs as superuser, so the trigger path under the `authenticated` role (old backend) is not proven by it.
- Nothing was run (read-only review): unit, SQL and iOS test results are not established by this round.

## Resolution (orchestrator)

- iOS proposal wording: fixed. The four strings now use the web wording, with en/de/it from the web catalogs, and the old keys are removed (`AssetPickerField.swift`, `NetWorthIntroSheet.swift`, `NetWorthIntroScene.swift`, `Localizable.xcstrings`).
- Signed reminder: fixed on both sides.
  - Web `asset-form-dialog.ts`: `asset-form-dialog.spec.ts` shows « −250,00 € » for an entry of −250, and « 400.00 CHF » for Livret 400 → −600 with the overdraft box ticked.
  - iOS `NetWorthSections.lastEntryCaption`: `NetWorthSectionsTests` covers the same two cases.
- `BUSINESS_RULES.md:69`, the logger provider and the `create-budget-line` comment: fixed.
- Parity: one rule on both sides. U+2212 for a drop. The year only when the entry is from an earlier year. Day and month never wrap apart on the web (NBSP), through `entry-date.ts`, which the row and the dialog now share.
- Reconciliation gate: kept `forceRefresh`. On iOS, `AssetStore.hasError` is `error != nil && netWorth == nil`, and a failed refresh keeps `netWorth`. So after an earlier load the gate still serves the cached assets, and a transient failure does not drop the linked rows. `AssetStoreTests` pins both cases.
- SQL test: it now runs the real migration file (`\ir`) twice on dismissals stored before it. It runs the trigger and CA11 as the `authenticated` owner. It also asserts that after the conversion only the Épargne of 200 is counted (10 200). A copy of the migration without its INSERT makes it fail.
- Deploy window and unarchive: product calls, written as Q3 and Q4 in `questions.md`. Vercel and Railway both deploy on the `production` push, and nothing orders them (`production-finalize.yml` only verifies after the fact).
- Debt order: its test lands with PUL-378, the first story where a movement raises a debt.
- Accessibility layout (defect from before this story): at accessibility text sizes the asset row and the Type header stack the name above the full amount (`NetWorthAssetRow.swift`, `NetWorthView.swift`). Checked on the simulator in `shots/ios-net-worth-dark-ax-large.png`. The default size is unchanged (`shots/ios-net-worth-light.png`).
