# Codebase Audit: « Comparer avec mes comptes » (security)

No actionable security finding: the new endpoints are scoped to the person, the table is locked down by RLS and grants, the starting amount is encrypted end to end including the rekey, and no amount, label or account name reaches logs or analytics.

- **Date**: 2026_11_22
- **Scope**: `git diff origin/main` + uncommitted tree of `claude/reconciliation-onboarding-redo` (HEAD `5ed3423a2`, base `b3656f067`) under `shared/src/calculators/account-reconciliation.ts`, `shared/schemas.ts` (reconciliation schemas), `backend-nest/src/modules/reconciliation/`, `backend-nest/supabase/migrations/20261121120000_create_user_reconciliation.sql` and its SQL tests, the encryption rekey changes, `frontend/projects/webapp/src/app/pattern/reconcile-accounts/`, `ios/Pulpe/Features/CurrentMonth/Reconciliation/`, `android/src/features/current-month/` (reconcile*, reconciliation*), plus the sign-out cleanup hooks they register into
- **Health**: good
- **Findings**: 0 critical, 0 major, 0 minor

## Findings

No finding introduced by this change. Each candidate below was checked against the code and the tests, and none held.

| Check | Evidence | Result |
| --- | --- | --- |
| Authn on both endpoints | `@UseGuards(AuthGuard)` on the controller, `backend-nest/src/modules/reconciliation/infrastructure/http/reconciliation.controller.ts:41`; the CLS-backed `AuthenticatedSupabaseProvider` throws `AUTH_UNAUTHORIZED` when no user is set (`backend-nest/src/modules/supabase/authenticated-supabase.provider.ts:28`) | holds |
| User scoping of `GET /reconciliation/:budgetId` | explicit `.eq('user_id', user.id)` on the ownership check (`.../persistence/supabase-reconciliation-state.repository.ts:33`), RLS-scoped client for the previous-budget chain; same 404 for a missing and a foreign budget, so no enumeration oracle; e2e `GET answers 404 for a real budget of another user` (`backend-nest/src/modules/reconciliation/reconciliation.e2e.spec.ts:325`) | holds |
| User scoping of `PUT /reconciliation/state` | upsert keyed on the session user (`supabase-reconciliation-state.repository.ts:53,66`), RLS `WITH CHECK` on insert and update | holds |
| RLS and grants | RLS enabled, three policies on `(SELECT auth.uid()) = user_id`, `REVOKE ALL` from `anon`/`authenticated`, then `SELECT, INSERT, UPDATE` only, no `DELETE` (`backend-nest/supabase/migrations/20261121120000_create_user_reconciliation.sql:30-49`); proven by `backend-nest/supabase/tests/user_reconciliation_rls.sql` (foreign read/update/insert blocked, anon blocked, no delete, cascade on user deletion) | holds |
| Input validation | `updateReconciliationStateSchema` is a `strictObject`, amount bounded to ±999 999 999.99, `completed: z.literal(true)`, at least one key (`shared/schemas.ts:3260-3276`); global `ZodValidationPipe` (`backend-nest/src/app.module.ts:366`); `ParseUUIDPipe` on the path id; e2e 400 cases (`reconciliation.e2e.spec.ts:141-147`); web and Android send through the same request schema (`frontend/projects/webapp/src/app/core/reconciliation/reconciliation-api.ts:33`, `android/src/features/current-month/reconciliation-api.ts:34`) | holds |
| Starting amount encrypted through `ENCRYPTION_PORT` | `text` ciphertext column with a non-blank check (`migration:21`), `encryptAmount` before write and `decryptAmount` on read (`supabase-reconciliation-state.repository.ts:55-58,81-84`); never returned as ciphertext | holds |
| Rekey keeps the amount readable after a PIN change or recovery | v4 RPC counts and rewrites the row under lock, v1-v3 refuse a person with a starting amount (`migration:59-357`); backend fetches, re-encrypts and sends it (`backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts:1033,1055-1058`); vault bootstrap refuses when only a starting amount holds ciphertext (`aes-gcm.crypto-service.ts:591-598`); `docs/ENCRYPTION.md:54` lists the column; `backend-nest/supabase/tests/rekey_user_reconciliation_rolling_deploy.sql` | holds |
| Nothing sensitive logged | the update use case logs `userId`, operation and field names only (`backend-nest/src/modules/reconciliation/application/update-reconciliation-state.use-case.ts:36-43`); no `console`/logger call in the web, Android or iOS feature code | holds |
| Analytics payloads | only `source` or `adjustment_kind`: web (`frontend/projects/webapp/src/app/pattern/reconcile-accounts/reconcile-guide.ts:237-262`, `reconcile-accounts-dialog.ts:633`), Android (`android/src/features/current-month/components/reconcile-guide-page.tsx:70-95`, `reconcile-accounts-sheet.tsx:390`), iOS (`ios/Pulpe/Features/CurrentMonth/Reconciliation/ReconcileGuideContent.swift:31-57`, `AccountReconciliation.swift:123`); names match `ANALYTICS_EVENTS` and `AnalyticsEvent.swift:73-80` | holds |
| Free account names stay on the device, names and sides only | web `saveFreeAccounts` keeps `{ name, side }` (`reconcile-free-accounts.ts:12-19`), iOS `Entry { name, isOwed }` (`ReconcileFreeAccountsStore.swift:10-13`), Android `{ name, side }` (`android/src/features/current-month/reconcile-free-accounts.ts:29-34`); no API call carries them | holds |
| Free account names cleared on sign-out | web: key scope `user` (`frontend/projects/webapp/src/app/core/storage/storage-schemas.ts:122`) cleared by `clearAllUserData` (`core/auth/auth-cleanup.service.ts:64`); iOS: `ReconcileFreeAccountsStore.shared.clear()` and the draft in `resetStores()` (`ios/Pulpe/App/SessionDataResetting.swift:52-53`), run by every `resetSession` scope (`ios/Pulpe/App/AppState+SessionReset.swift:354`); Android: `clearFreeAccounts()` and `keepReconcileDraft(null)` in the single teardown shared by explicit and provider-driven sign-out (`android/src/core/auth/session-store.ts:178-179,205`) | holds |
| Tampered device storage | read side validated: web Zod schema (`storage-schemas.ts:44`), Android `safeParse` (`reconcile-free-accounts.ts:22`), iOS `try? JSONDecoder` | holds |
| Session replay | web amounts and names wrapped in `ph-no-capture` (for example `reconcile-compare-step.ts:288,311`, `reconcile-reasons-sheet.ts`, `reconcile-add-account-sheet.ts`); inputs covered by `maskAllInputs`; iOS replay off (`ios/Pulpe/Core/Analytics/AnalyticsService.swift:488`) | holds |
| Secrets, injection, unsafe deserialization | no hardcoded secret; PostgREST builder parameters only; the rekey functions are `SECURITY DEFINER` with `search_path ''`, granted to `service_role` only | holds |

Pre-existing, not caused by this change (do not gate the merge on it):

- `backend-nest/src/modules/account-deletion/application/cleanup-expired-deletions.use-case.ts:28-33`: the RGPD cascade inventory in the comment already omits several user tables and now also omits `user_reconciliation`. The cascade itself is real and tested (`user_reconciliation_rls.sql`). Doc-only drift.

## Top actions

1. None required for this pillar.
2. Optional, pre-existing: add `user_reconciliation (user_id)` to the cascade inventory comment in `cleanup-expired-deletions.use-case.ts` the next time that file is touched.

## Coverage

- **Scanned**: security
- **Skipped**: dynamic testing (no local Supabase run, machine load ~22); evidence comes from static reading plus the existing e2e and SQL tests, which were read, not rerun.
