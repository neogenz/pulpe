# PUL-378 validation (branch feat/pul-378-compte-par-mouvement, `470aa95a7..HEAD` at 82a5b4a41)

Suites run on the current tree:

- Backend `bun test src/common/utils/asset-link.spec.ts src/modules/{asset,budget-line,budget-template,transaction,transaction-import,user}`: 777 pass, 0 fail (with `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` from `.env.local`; without them 18 older integration specs fail at user creation, an env issue, not this change). `budget-line-asset-link.integration.spec.ts`: 7 pass.
- SQL (local DB, migrations 20261125120000..150000 applied and unchanged since): `movement_account_link`, `movement_account_writes`, `prevision_account_copies`, `user_default_account`: all assertions passed, each in a rolled-back transaction.
- Shared `vitest run budget-formulas.spec.ts movement-account-schema.spec.ts`: 138 pass.
- Frontend `ng test` on 30 files (account-picker, budget-line create/edit, edit-transaction-form, budget-details store/page, add-transaction-form, current-month, net-worth, settings, user-settings-store, transaction-api, edit-template-line-dialog, reconcile-accounts): 641 pass.
- Android `jest` net-worth, budget-line-sheet, template-line-sheet, transaction-sheet, current-month, account: 413 pass (48 suites).
- iOS: read only (not run, per brief).

Abbreviations:
F = backend-nest/src/modules/asset/domain/asset.formulas.spec.ts ("computeNetWorth: a movement moves its account (PUL-378)")
CT = backend-nest/src/modules/transaction/application/create-transaction.use-case.spec.ts
SQL-L/W/C/D = backend-nest/supabase/tests/movement_account_link / movement_account_writes / prevision_account_copies / user_default_account .sql
AP = frontend/.../pattern/account-picker/account-picker-field.spec.ts
iAL = ios/PulpeTests/Domain/Models/AccountLinkTests.swift; iND = ios/PulpeTests/Features/NetWorth/NetWorthDefaultAccountTests.swift
Android (screens are out of the contract's scope) = android/src/features/...; listed only where it adds proof.

| CA | Platform | Proof | Verdict | Note |
|---|---|---|---|---|
| CA1 | web | AP "CA1: offers « Aucun », then what I have, then what I owe"; add-transaction-form.spec "CA1, CA3"; edit-transaction-form.spec "shows « Compte » on a free movement"; create/dialog.spec "CA1"; edit/dialog.spec "CA1"; edit-template-line-dialog.spec "CA1, CA3"; capture add-transaction-account-open-desktop-light.png (Aucun / Ce que j'ai / Ce que je dois) | proven | Tests use one nature per form; Revenu/Épargne not asserted form by form |
| CA1 | iOS | iAL "CA1: the picker lists what I have, then what I owe, active elements only" (archived card excluded); picker wired in MovementSheet, AddBudgetLineSheet, EditBudgetLineSheet, EditTemplateLineSheet; capture ios-fr-account-picker-open.png | proven | Test covers the store grouping; « Aucun » + headers shown by the capture only |
| CA2 | web | AP "CA2: renders nothing with the flag off" / "without an active item"; create/dialog.spec, add-transaction-form.spec "CA2" (field absent, null sent) | proven | |
| CA2 | iOS | iAL "CA2: the picker is absent with the flag off or no active element", "CA2: with the field absent a creation still states « Aucun »" | proven | |
| CA3 | web | AP "CA3: starts on « Aucun » without a default account"; create/dialog.spec "CA3"; add-transaction-form.spec "CA1, CA3" | partial | Value is null as required, but the closed mat-select shows an empty field (label « Compte » only), not the word « Aucun »: add-transaction-account-mobile-light.png, settings-default-account-desktop-light.png |
| CA3 | iOS | iAL "CA3: without a default account the field starts on « Aucun »" | proven | |
| CA4 | server | CT "CA4: an allocated movement stores no account"; update-transaction.use-case.spec "CA4: ignores an account sent for a movement allocated"; SQL-L list_asset_movements (real rows read through the prévision) | proven | |
| CA4 | web | edit-transaction-form.spec "CA4: shows no « Compte » on a movement under a prévision", "CA26: sends no accountId when the field is not shown" | proven | Allocated create dialog sends no accountId (read: allocated-transactions/create-dialog/form.ts) |
| CA4 | iOS | iAL "CA4: an allocated movement shows no account and sends none" | proven | |
| CA5–CA9 | server | F "CA5" (4 920 / 7 320), "CA6" (11 000 / 13 400), "CA7" (4 500, 10 500, 7 400), "CA8" (4 700, 7 700), "CA9" (9 000, 6 000); get-net-worth.use-case.spec "PUL-378 CA6"; SQL-L list_asset_movements returns free checked rows with account_id | proven | Web/iOS only display `GET /v1/assets`: n.a. |
| CA10, CA12 | server | F "CA10, CA12" (5 000); SQL-L section 3: unchecked free movement not listed | proven | Deletion = row gone, nothing to list |
| CA11 | server | F "CA11" (5 000, Revolut 320); update-transaction.use-case.spec "CA11"; SQL-W [1]/[2] | proven | |
| CA13 | server | F "CA13" (5 000, 10 500) | proven | |
| CA14 | server | F "CA14" (−100, debts 8 100, net 6 900) | proven | « Découvert » label is the pre-existing rule, not re-tested |
| CA15 | server | F "CA15: an entry of 4 880 … 4 600" + "a movement checked at the very instant of the entry is already in it" | proven | |
| CA16 | server | F "CA16" ×2; get-net-worth.use-case.spec "PUL-378 CA16" ×2 | proven | |
| CA17–CA20 | server | F "CA17" 4 880, "CA18" 4 600, "CA19" 4 550, "CA20" 4 400 / 10 600 | proven | |
| CA21 | server/shared | F "CA21" compares to `BudgetFormulas.calculateRealizedBalance` on a mixed month | proven | |
| CA43 | server/shared | F "CA43" (11 000 vs budget 12 000) | proven | |
| CA22 | server | SQL-C [2] (propagates, manual line kept, null clears); bulk-template-line-operations.use-case.spec "CA22" | proven | |
| CA22 | web | edit-template-line-dialog.spec "CA30", "CA2, CA26" (dialog output) | partial | No test asserts the account reaches the bulk/propagation payload (`template-line-store.ts:199,274`); template-line-store.spec has no accountId case |
| CA22 | iOS | iAL "CA26: a template line and a free movement follow the same three states" (`propagationUpdate` carries accountId) | proven | helper level |
| CA23 | server | SQL-C [3]; create-budget-line-spread "CA23"; spread-budget-line-from-line "CA23"; spread-transaction-from-txn "CA23" | proven | |
| CA23 | web | create/dialog.spec "CA29: a spread carries the account on every occurrence" | proven | |
| CA23 | iOS | iAL "Create bodies of a prévision, a model line and a spread carry the three states" | proven | |
| CA46 | server | SQL-L section 4 (freed movements keep Revolut, read as free); F "CA46" (0 then 280) | proven | |
| CA46 | web | budget-details-store-integration.spec "its real movements stay in the budget with the prévision account" | proven | |
| CA24 | server | SQL-L section 5 (archive keeps link, delete clears to null on movements, prévision, template line); F "CA24" | proven | |
| CA24 | web/iOS | AP CA1 and iAL CA1 offer active elements only | proven | |
| CA25 | server | SQL-L section 2, SQL-W [2]/[3]; budget-line-asset-link.integration.spec "CA25" ×2 (real PostgREST error → 400); asset-link.spec "CA25"; supabase-budget-line.repository.spec "CA25" | proven | |
| CA25 | web | AP "CA25: shows the error message under the field"; create/dialog.spec, edit/dialog.spec, edit-template-line-dialog.spec "CA25" | proven | |
| CA25 | iOS | iAL "CA25: … conflict with a message", "CA25: a link chosen on purpose stays and is refused" | proven | Save blocked by `AccountLink.conflicts` in the sheets (read) |
| CA26 | server | SQL-W [1]/[2]/[3]; update-transaction, update-budget-line, update-template-line, bulk-template "CA26"; repository spec "CA26" | proven | |
| CA26 | web | edit/dialog.spec "CA26", edit-transaction-form.spec "CA26", edit-template-line-dialog.spec "CA2, CA26" | proven | |
| CA26 | iOS | iAL "CA26: an untouched edit omits accountId…", "CA26: a template line and a free movement…" | proven | |
| CA27 | shared | budget-formulas.spec "accounts do not change the budget (PUL-378 CA27, CA42)" (metrics + realized balance with rollover 250, equal with/without accounts) | proven | iOS formulas take no account field: by construction, no iOS test |
| CA28 | server | SQL-D (write/read, RLS, foreign asset refused); supabase-user.repository.spec CA28 | proven | |
| CA28 | web | settings-page.spec "CA28" ×3 + "shows the account the store holds, so both screens agree"; user-settings-store.spec "CA28, CA47"; capture settings-default-account-desktop-light.png | proven | |
| CA28 | iOS | iND "CA28: the preference row is absent…", "CA28: the setting is written, then read back"; PreferencesView uses AccountPickerField; capture ios-preferences-default-account-light.png | proven | |
| CA47 | web | net-worth-asset-row.spec "CA47" ×2, "CA34, CA47"; net-worth-page.spec "CA47" ×2, "CA34, CA47"; captures net-worth-badge-desktop-light.png, net-worth-menu-desktop-light.png | proven | |
| CA47 | iOS | iND "CA47" ×4; captures ios-fr-net-worth-menu-default.png (« Ne plus utiliser par défaut », badge) | proven | |
| CA29 | server | CT "CA29: a chosen account wins over the default" | proven | |
| CA29 | web | AP "CA29"; add-transaction-form.spec "CA29, CA36", "CA29: lets the user pick another account or « Aucun »"; create/dialog.spec "CA29"; edit-template-line-dialog.spec "CA29" | proven | |
| CA29 | iOS | iAL "CA29: with Compte courant as default…"; capture ios-fr-movement-account-light.png (prefilled) | proven | |
| CA30 | server | SQL-D "CA28, CA30" (no budget_line, template_line or transaction gets an account) | proven | |
| CA30 | web | edit-template-line-dialog.spec "CA30: an existing line keeps its own account, never the default" | proven | |
| CA31 | server | SQL-C [1] (account copied, line without account → prévision without); reset-budget-line-from-template "CA31" | proven | The SQL runs without a default set; the RPC never reads `user_default_account` (0 references in the migration) |
| CA32 | server | CT "CA32, CA36", "CA32, CA44", "CA32: … not yet checked takes the default", "CA4, CA32"; create-budget-line "CA32" ×2; create-budget-line-spread "CA32"; confirm-transaction-import.use-case.spec "hands the default account to the batch"; supabase-transaction-import.repository.spec (free row default, attached none); asset-link.spec | proven | Assistant (`add-movement.tool.ts`) goes through CreateTransactionUseCase without accountId |
| CA44 | server | CT "CA44: the gap « %s » from an app that sends no account stays without account" (current and legacy names), "CA32, CA44" | proven | |
| CA44 | web | current-month.spec CA44 comment block, budget-details-page.spec, transaction-api.spec (explicit null kept) | proven | |
| CA44 | iOS | ReconcileAdjustmentRequestTests "the gap's POST body states « Aucun » explicitly" (real flow → service → APIClient bytes); iAL "CA44" | proven | |
| CA44 | Android | current-month/reconciliation.spec "(CA44)", reconcile-accounts-sheet.spec | proven | |
| CA45 | server | asset-link.spec "CA45"; create-budget-line "CA45"; create-budget-line-spread "CA45"; F "CA45" (Livret 10 500) | proven | |
| CA45 | web | create/dialog.spec "CA45" ×2; edit-template-line-dialog.spec "CA45" | proven | |
| CA45 | iOS | iAL "CA45" ×2 | proven | helper level |
| CA33 | server | SQL-D "CA33"; CT "CA33"; supabase-user.repository.spec CA33 | proven | |
| CA33 | web/iOS | user-settings-store.spec "CA28, CA47"; iND "CA47: choosing Revolut moves the setting off Compte courant" + CA29 prefill reading the store | proven | by composition |
| CA34 | server | SQL-D "CA34"; CT "CA34"; repository spec CA34 | proven | |
| CA34 | web | settings-page.spec "(CA34)"; user-settings-store.spec "CA34"; net-worth-page.spec "CA34, CA47" | proven | |
| CA34 | iOS | iND "CA28, CA34: choosing Livret then « Aucun » sends the id, then an explicit null" | proven | |
| CA35 | server | SQL-D "CA35" (archive clears, unarchive does not restore, delete clears) | proven | |
| CA35 | web | net-worth-page.spec "CA35: archiving or deleting reloads the setting" | proven | |
| CA35 | iOS | iND "CA35" ×2 | proven | |
| CA36 | server | CT "CA32, CA36"; create-budget-line "CA32, CA36"; F "CA36" (9 420) | proven | |
| CA36 | web | add-transaction-form.spec "CA29, CA36: starts on the default account and sends it untouched" | proven | |
| CA37–CA41 | server | F "CA37" (280, 8 280, 7 120, 5 000), "CA38" (200), "CA39" (150, then 0), "CA40" (500, 7 700, 7 200), "CA41"; plus "takes a debt in check order" (PUL-377 CA6 ordering half) | proven | |
| CA42 | shared | budget-formulas.spec "accounts do not change the budget (PUL-378 CA27, CA42)" | partial | Proves accounts leave the month's metrics unchanged; nothing models the card debit in the following month (true by construction: no movement is ever created automatically) |

## Gaps

- CA3 / CA28, web: « Aucun » is the null option of a mat-select, so the closed field showed blank. **Fixed** in 3fc3277c0 (placeholder « Aucun », label always floating). Test `account-picker-field.spec` "CA3: the closed field reads « Aucun »" fails without the fix. Captures `add-transaction-account-none-{mobile-light,mobile-dark,desktop-light}.png`.
- CA22, web: no test that a changed template-line account reaches the propagation payload. **Fixed** in cd4049ab3 (`template-line-store.spec` "CA22").
- CA42: partial, by construction only (no movement is ever created automatically). Accepted.
- CA27, iOS: no test; the Swift formulas take no account input. Accepted, by construction.
- CA1: forms tested on one nature each; Revenu/Épargne not asserted per form. Accepted: the field is rendered and sent independently of the nature on every platform (read in each form).
- iOS overall: proofs are helper-level Swift Testing tests plus captures. The full iOS suite ran green on the final tree (2756 tests in 313 suites).

## Final tree run (after the review fixes)

- shared 973 pass; backend 2242 pass, 0 fail (with the local Supabase keys); backend quality 0 errors; web 3747 pass, `typecheck:spec` and `ng build` OK; Android 1563 pass, tsc/eslint/prettier OK; root `pnpm quality` OK; iOS 2756 pass.
- SQL: 32/33. `user_feedback_rls.sql` fails on the shared local database because it holds one feedback row from 14 Nov (the test expects an empty table): unrelated to PUL-378.
