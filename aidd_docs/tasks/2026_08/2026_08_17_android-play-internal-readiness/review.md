# Review: Android PR #608 and Play internal-test readiness

- **Verdict**: blocked
- **Diff**: `origin/preview...9d8f77c9e`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_17
- **Findings**: 2 critical, 5 warning, 1 minor

## Phases

### Phase 1 — Reconcile the branch with `preview`

- [x] GitHub reports the PR mergeable and the reconciled contracts retain both consumers — merge commit `89cb2f977`, PR #608 `mergeable=true`
- [x] The integration baseline is isolated before the behavioral fixes and its checks passed — `89cb2f977` precedes `74fdc9d83`; PR #608 checks at `9d8f77c9e` are green

### Phase 2 — Secure the password-recovery boundary

- [x] Recovery launches cannot enter PostHog lifecycle capture — `android/src/core/observability/analytics.ts:64`, `android/src/core/observability/analytics.spec.ts:62`
- [ ] Success, Back and close do not guarantee removal of a persisted recovery session after a global sign-out failure — `android/src/app/reset-password.tsx:73`, `android/src/core/auth/session-store.ts:51`

### Phase 3 — Preserve savings invariants and query truth

- [x] Planned-withdrawal kind and recurrence are locked in Android and revalidated on the merged backend entity — `android/src/features/budget-details/components/budget-line-sheet.tsx:111`, `backend-nest/src/modules/budget-line/domain/budget-line.invariants.ts:92`
- [x] Planned withdrawals are absent from point controls and unchecked counts — `android/src/features/budget-details/components/budget-line-row.tsx:63`, `android/src/features/current-month/current-month-view-model.ts:260`
- [ ] Editing a planned withdrawal invalidates only budget queries, leaving a mounted goal query fresh and stale — `android/src/features/budget-details/components/budget-line-sheet.tsx:174`, `android/src/features/budget-details/budget-line-mutations.ts:28`

### Phase 4 — Make modal and settings failure states trustworthy

- [x] Sheets use the native modal boundary and block Back/scrim dismissal while their write is pending — `android/src/core/ui/sheet.tsx:63`, `android/src/core/ui/sheet.spec.ts:36`
- [x] The system gate is a final non-dismissible native modal and authenticated routes wait for real settings — `android/src/core/system/system-gate-screen.tsx:64`, `android/src/core/user-settings/required-settings-gate.tsx:14`

### Phase 5 — Prove the delivery path and publish internally

- [ ] Workflow syntax and repository versions are aligned, but no production AAB has yet proved the final user-facing version — `android/.eas/workflows/deploy-production.yml:10`, `android/app.json:5`, `aidd_docs/tasks/2026_08/2026_08_17_android-play-internal-readiness/phase-5.md:91`
- [x] Applicable PR checks, final preview APK, CodeQL languages and Maestro smoke are green with no Python gate — PR #608 at `9d8f77c9e`
- [ ] The reviewed commit has not been merged, installed from Play, signed into, App-Link verified or smoke-tested by the internal tester — `aidd_docs/tasks/2026_08/2026_08_17_android-play-internal-readiness/phase-5.md:90`

## Findings

| Sev         | Kind       | Phase | Location                                                                                 | Issue                                                                                                                                                                                                                                | Fix                                                                                                                                                                                                  |
| ----------- | ---------- | ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 critical | functional | 2     | `android/src/app/reset-password.tsx:73`                                                  | `endRecovery` clears `hasRecoverySession` in `finally` even when global revocation fails. The app store is made anonymous, but the persisted Supabase recovery session is not forcibly removed; a retry or exit then skips teardown. | Keep the recovery flag until teardown succeeds, force local Supabase session/storage removal when global revocation fails, handle Back/close rejection, and test persisted storage plus retry paths. |
| 🔴 critical | functional | 5     | `aidd_docs/tasks/2026_08/2026_08_17_android-play-internal-readiness/phase-5.md:90`       | The exact reviewed commit has not reached the friend's Play opt-in installation or the critical Play-signed smoke journey.                                                                                                           | Complete reviewer approval, Play identity/device verification, merge, production AAB draft, Play signing fingerprints, tester enrollment and the documented smoke checks.                            |
| 🟡 warning  | code       | 2     | `android/src/core/auth/session-store.ts:39`                                              | Ordinary sign-out purges account data only after `signOutThisDevice` resolves; a thrown storage/client failure leaves decrypted account state mounted, and `signOutThisDevice` also ignores Supabase's returned error.               | Put local purge and anonymous publication in `finally`, preserve/report the remote error, and add the same failure-path regression used for recovery.                                                |
| 🟡 warning  | functional | 3     | `android/src/features/budget-details/budget-line-mutations.ts:28`                        | Budget-line edits invalidate only `budgetKeys`; changing a planned withdrawal amount/name does not refresh the mounted goal. The source-text test omits this mutation family.                                                        | Invalidate `goalKeys.all` after budget-line writes that can affect goals and replace/extend the test with a query-client contract covering planned-withdrawal editing.                               |
| 🟡 warning  | code       | -     | `android/src/app/(main)/budget/[id]/line/[lineId].tsx:116`                               | A cold detail-query failure is rendered as “Cette prévision n'existe plus”, with no retry, because missing data is checked before `details.isError`.                                                                                 | Render a retryable query error before the successful-response missing-line branch.                                                                                                                   |
| 🟡 warning  | functional | 5     | `android/.eas/workflows/deploy-production.yml:10`                                        | The corrected production workflow and version have not been exercised as an AAB, so criterion 1 is only partially proven.                                                                                                            | After the human prerequisites, run the workflow from the merged reviewed SHA and verify the AAB version before promotion.                                                                            |
| 🟡 warning  | fit        | 5     | `android/package.json:52`, `landing/package.json:30`                                     | The final EAS build succeeds but still annotates `expo doctor` as failed because its monorepo scan sees Android React 19.2.3 and landing React 19.2.8. The delivery signal is therefore not fully deterministic.                     | Isolate the Android/shared dependency graph for EAS Doctor or explicitly scope the check without downgrading landing or violating Expo SDK 57's React pin.                                           |
| 🟢 minor    | rot        | 5     | `android/docs-android/RELEASE.md:3`, `android/docs-android/RELEASE.md:151`, PR #608 body | Release documentation and the PR body still say remote Maestro/native modal work has never run or was not delivered, contradicting the final build and diff.                                                                         | Update the release snapshot and PR description to the final verified state.                                                                                                                          |

## Verification

| Metric        | Value                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Verified      | 67% (8/12)                                                                                                                     |
| Files checked | PR #608 diff and metadata, 48-file implementation delta `89cb2f977...9d8f77c9e`, Phase 1 conflict set, final GitHub/EAS status |
| Unchecked     | Phase 2 criterion 2 — fix; Phase 3 criterion 3 — fix; Phase 5 criterion 1 — fix; Phase 5 criterion 3 — fix                     |
| Unplanned     | Ordinary sign-out failure path; detail-route query error branch; Expo Doctor monorepo annotation; stale release narrative      |
