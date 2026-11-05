# Review: Mon patrimoine (web)

- Rounds: 1
- Started: 2026-11-05

## Round 1 · r-7c3e

- Date: 2026-11-05
- By: Maxime De Sogus
- Diff: `origin/main...caf6e62ab`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 21/33 met, 0 unmet, 12 unverified at runtime, 0 out of the diff

### Criteria

- [x] 1.2 RLS, composite FKs, RESTRICT, cascade — `backend-nest/supabase/migrations/20261103120000_create_net_worth_tables.sql:17`
- [x] 1.3 Rekey v1/v2 refuse a user with snapshots, v3 all or nothing — `20261103120000_create_net_worth_tables.sql:196`, `tests/rekey_asset_snapshot_rolling_deploy.sql`
- [x] 1.4 Snapshots re-encrypted by the backend rekey — `backend-nest/src/modules/crypto/aes-gcm.crypto-service.ts`
- [x] 2.1 Schemas from `pulpe-shared`, unknown keys rejected — `shared/src/asset-schema.spec.ts:24`
- [x] 2.2 Formula spec covers mixed currencies, overdraft, archived, missing rate, negative net — `backend-nest/src/modules/asset/domain/asset.formulas.spec.ts:44`
- [x] 2.3 Snapshot stored encrypted, only the adapter imports `CurrencyService` — `supabase-asset.repository.spec.ts:108`
- [x] 2.4 Negative debt refused, missing rate sets `incomplete` — `asset.invariants.ts:10`, `get-net-worth.use-case.ts:51`
- [x] 3.1 Flag resolves, Sankey plugin only in the lazy chunk — `net-worth-sankey.ts:13`, `app.routes.ts:149`
- [x] 3.2 Asset cache cleared at logout, mutations invalidate it — `core/asset/asset-api.ts:54`
- [x] 3.3 Page refreshes after writes, starter category created once — `net-worth-store.ts:60`
- [x] 3.5 Nav entry only with the flag on — `layout/main-layout.ts:847`
- [x] 4.1 In-Pulpe rows in budget currency, one empty row otherwise — `reconcile-accounts-dialog.service.ts:40`
- [x] 4.2 Rows come only from the dialog data — `reconcile-accounts-dialog.ts:158`
- [x] 4.3 One snapshot per filled linked row — `reconcile-accounts-dialog.ts:383`
- [x] 5.2 Guard trigger, RPCs still INVOKER, SQL test — `20261103130000_link_prevision_to_asset.sql:43`
- [x] 6.1 Dismissal column, expand migration — `20261103140000_asset_suggestion_dismissal.sql`
- [x] 6.2 Suggestion values, >1000 rows paged — `asset.formulas.ts:113`, `supabase-asset.repository.spec.ts:321`
- [x] 6.3 Apply and dismiss cutoffs — `asset.formulas.ts:98`
- [x] 7.1 Revenue-origin switch on main — `create/dialog.ts:90`
- [x] 7.2 Revenu drawn from an asset carries `assetId` and lowers the suggestion — `create/dialog.ts:584`
- [x] 7.3 Edit dialog shows the asset origin read-only — `edit/dialog.ts:306`
- Unverified at runtime: 1.1, 1.5, 2.5, 3.4, 3.6, 4.4, 5.1, 5.3, 5.4, 5.5, 6.4, 7.4 — gate runs (`pnpm quality`, `bun run quality`, `ng build`, e2e, lexicon) on `caf6e62ab`

### Findings

- `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-sankey.ts:141` : chart colors are resolved once in `afterNextRender`; after a light/dark switch the labels and nodes keep the old theme and become unreadable (seen in the browser) → recompute the colors from `ThemeService.isDark()` in an `afterRenderEffect` — 🟡 major, frontend
- `frontend/projects/webapp/src/app/feature/net-worth/services/net-worth-store.ts:60` : no write is guarded while in flight; a double click on Appliquer posts two snapshots, Enter twice in the categories dialog posts a duplicate category; an overlapped failure surfaces the generic `common.error` → expose the pending state and disable the actions while it is true — 🟡 major, frontend
- `frontend/projects/webapp/src/app/app.routes.ts:142` : `/net-worth` has no flag gate, only the nav entry checks `net_worth`; the whole page and its writes open by URL with the flag off → `canMatch` guard on the flag, waiting for flags to resolve — 🟡 major, architecture
- `backend-nest/src/modules/asset/application/remove-asset.use-case.ts:19` : deleting an asset nulls `budget_line.asset_id` / `template_line.asset_id` (`ON DELETE SET NULL`) without invalidating the budget details cache (30s) nor the frontend budget/template caches; an edit in that window resends the deleted id and gets a 404 → `cacheService.invalidateForUser` after delete, and invalidate the budget/template caches on the frontend delete — 🟡 major, backend
- `frontend/projects/webapp/src/app/pattern/asset-picker/asset-picker-field.ts:38` : `injectNetWorthResource` is data access inside a UI pattern, imported by both budget-line dialogs, and the same loader is written again in `net-worth-store.ts:36` and `reconcile-accounts-dialog.service.ts:73` → one loader in `core/asset` reused by all three — 🟡 major, architecture
- `frontend/projects/webapp/public/i18n/fr.json:1482` : the mobile hint « jusqu'à ta fortune nette » shows when net worth is negative and the chart has no Fortune nette node → a second hint for the debts case, like `subtitleDebts` — 🟢 minor, frontend
- `frontend/projects/webapp/public/i18n/fr.json:1551` : « -1'000.00 CHF de revenu tiré » doubles the sign with the verb; same for « -400.00 CHF de remboursement pointé » → show the magnitude, the verb carries the direction — 🟢 minor, frontend
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line/edit/dialog.ts:611` : `onKindChange` clears `assetId` even when the kind comes back to its original, losing a Revenu's origin → restore the original `assetId` — 🟢 minor, frontend
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line/create/dialog.ts:301` : « Tiré de mon patrimoine » can be saved with "aucun" asset and silently creates an unlinked Revenu → require the asset when that origin is chosen — 🟢 minor, frontend
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line/create/dialog.ts:548` : flag read, direction computed, kind reset and picker block are copy-pasted in three dialogs (`edit/dialog.ts:247`, `edit-template-line-dialog.ts:218`) → give `AssetPickerField` a `kind` input and let it own the flag and direction — 🟢 minor, code-health
- `frontend/projects/webapp/src/app/feature/net-worth/net-worth-page.ts:355` : `store.refresh()` in the constructor forces a network fetch on every visit, redundant with the cache invalidation in `asset-api.ts:54` → delete it — 🟢 minor, performance
- `frontend/projects/webapp/src/app/feature/net-worth/services/net-worth-store.ts:125` : the doc says the call resolves after the refetch; `invalidate()` does not await it → fix the comment — 🟢 minor, standards
- `frontend/projects/webapp/src/app/feature/net-worth/net-worth-page.ts:413` : the `#attempt` error-snackbar block is duplicated in `asset-categories-dialog.ts:269` → one helper in `NetWorthDialogService` (`feature-dialog-services.md`) — 🟢 minor, rot
- `frontend/projects/webapp/src/app/feature/net-worth/net-worth-page.ts:229` : the archived toggle has no `aria-expanded` — 🟢 minor, frontend
- `frontend/projects/webapp/public/i18n/fr.json:1549` : « Pulpe propose » breaks the solo « je » voice the plan sets; `:1545` already says « je te propose » → « Je propose » — 🟢 minor, conform
- `frontend/projects/webapp/public/i18n/fr.json:1462` : `totals.gross` is « Ce que j'ai » on the pill and « Fortune brute » in the Sankey → one label — 🟢 minor, fit
- `aidd_docs/tasks/2026_11/2026_11_03_mon-patrimoine/phase-3.md` : §4.1 still says "no net node when net ≤ 0, debt flows scaled to gross"; the code now draws « Il manque » and drops the single-asset category column → update §4.1 and its Test Scope — 🟢 minor, fit
- `backend-nest/src/modules/asset/infrastructure/persistence/supabase-asset.repository.ts:151` : every `GET /assets` pages the whole snapshot history to keep the newest row per asset, and `:203` sends one request per asset for checked lines → `DISTINCT ON` read and one `.in()` call via `fetchRowsByParentIds` when volume matters — 🟢 minor, performance
- `backend-nest/src/modules/asset/infrastructure/persistence/supabase-asset.repository.ts:265` : asset + first snapshot are two statements with best-effort compensation; a double failure leaves an invisible asset that blocks its category delete → one invoker RPC — 🟢 minor, backend
- `backend-nest/supabase/migrations/20261103120000_create_net_worth_tables.sql:112` : `authenticated` keeps UPDATE on `asset_snapshot` though the API never updates it; a direct PATCH with garbage makes `GET /assets` 500 (self only) → revoke in a new contract migration, like the direction freeze — 🟢 minor, security
- `backend-nest/src/modules/asset/application/dismiss-asset-suggestion.use-case.ts:25` : dismissal stamped with the app clock while `checked_at` uses DB `now()` → let the DB stamp it — 🟢 minor, backend
- `backend-nest/src/modules/asset/asset.tokens.ts:1` : unused re-exports; `AssetInsert`, `AssetSnapshotRow` in `asset.entity.ts:10` unused → delete — 🟢 minor, code-health
- `shared/schemas.ts:3109` : `assetSuggestionSchema` is not re-exported and the backend redefines the type in `asset.entity.ts:62` → export and reuse — 🟢 minor, rot
