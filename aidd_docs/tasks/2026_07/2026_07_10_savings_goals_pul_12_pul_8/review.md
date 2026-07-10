# Review: Savings goals PUL-12 + PUL-8

- **Verdict**: blocked
- **Diff**: `origin/preview...f0a9efd46ab194ea6e38d7375dbfb735aa0cf628`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_10
- **Findings**: 1 critical, 12 warning, 4 minor

## Phases

### Phase 1 — PUL-12 backend

- [x] CA1 create goal — `backend-nest/src/modules/savings-goal/infrastructure/http/savings-goal.controller.ts:40`
- [x] CA2 list decrypted targets — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:59`
- [x] CA3 detail decrypted target — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:87`
- [x] CA4 partial update and reversible statuses — `backend-nest/src/modules/savings-goal/application/update-savings-goal.use-case.ts:21`
- [x] CA5 delete unlinks without deleting lines — `backend-nest/supabase/migrations/20260701083000_savings_goal_template_link_pul12.sql:30`
- [x] CA6 AES-256-GCM target encryption and dedicated mapper — `backend-nest/src/modules/savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts:332`
- [x] CA7 RLS user isolation — `backend-nest/src/modules/savings-goal/savings-goal.integration.spec.ts:137`
- [x] CA8 budget-line tagging — `backend-nest/src/modules/budget-line/application/update-budget-line.use-case.ts:38`
- [x] CA9 template link plus SET NULL foreign keys — `backend-nest/supabase/migrations/20260701083000_savings_goal_template_link_pul12.sql:17`
- [x] CA10 generation and RG-001 propagation — `backend-nest/supabase/migrations/20260701083100_savings_goal_propagation_pul12.sql:1`
- [x] CA11 non-saving kind clears link — `backend-nest/src/common/utils/savings-goal-link.ts:15`
- [x] CA12 dedicated FX mapper — `backend-nest/src/modules/savings-goal/infrastructure/mappers/savings-goal.mapper.ts:24`
- [x] CA13 FX coherence constraint — `backend-nest/supabase/migrations/20260701083000_savings_goal_template_link_pul12.sql:47`

### Phase 2 — PUL-12 shared

- [x] CA14 schemas exclude priority and validate target date — `shared/schemas.ts:238`
- [x] CA15 template-line schemas expose savingsGoalId — `shared/schemas.ts:748`
- [x] CA16 budget-line update exposes savingsGoalId — `shared/schemas.ts:619`

### Phase 3 — PUL-12 iOS

- [x] CA17 dashboard savings entry is actionable — `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:133`
- [x] CA18 first-goal empty state — `ios/Pulpe/Features/SavingsGoals/SavingsGoalsListView.swift:53`
- [ ] CA19 CRUD and reversible statuses — date-only serialization can send the previous day in Europe/Zurich at `ios/Pulpe/Domain/Models/SavingsGoal.swift:88`
- [x] CA20 template-line goal picker — `ios/Pulpe/Features/Templates/TemplateDetails/EditTemplateLineSheet.swift:126`
- [x] CA21 budget-line add/edit goal picker — `ios/Pulpe/Shared/Components/EditBudgetLineSheet.swift:103`
- [x] CA22 navigation, service, list and detail — `ios/Pulpe/App/MainTabView.swift:105`

### Phase 4 — PUL-12 web

- [x] CA23 list route and first-goal empty state — `frontend/projects/webapp/src/app/feature/savings-goals/savings-goals.routes.ts:5`
- [x] CA24 dashboard action remains interactive outside ph-no-capture — `frontend/projects/webapp/src/app/feature/current-month/components/dashboard-savings-summary.ts:44`
- [x] CA25 create/edit/status including overdue edit — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.schema.ts:47`
- [x] CA26 template and budget-line pickers — `frontend/projects/webapp/src/app/pattern/savings-goal-picker/savings-goal-picker-field.ts:17`

### Phase 5 — PUL-12 common UX

- [x] CA27 target uses account currency — `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-form-dialog.ts:82`
- [x] CA28 savings states remain neutral/primary — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:551`

### Phase 6 — PUL-8 backend

- [x] CA1 planned and confirmed calculations — `shared/src/calculators/savings-goal-progress.ts:166`
- [x] CA2 confirmed achievement percentage with zero guard — `shared/src/calculators/savings-goal-progress.ts:177`
- [x] CA3 payDay-aware pace, required and projected — `shared/src/calculators/savings-goal-progress.ts:183`
- [x] CA4 overdue neutralization — `shared/src/calculators/savings-goal-progress.ts:187`
- [x] CA5 completion remains a suggestion — `shared/src/calculators/savings-goal-progress.ts:201`
- [x] CA6 FX fields remain null in v1 — `backend-nest/src/modules/savings-goal/infrastructure/mappers/savings-goal.mapper.ts:77`

### Phase 7 — PUL-8 iOS

- [x] CA7 detail renders planned and Pointé layers — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:144`
- [x] CA8 pace stays neutral/primary — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:205`
- [x] CA9 D1, D2 and reopen actions — `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:217`

### Phase 8 — PUL-8 web

- [x] CA10 detail parity and Pointé vocabulary — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:187`
- [ ] CA11 neutral pace and D1 — D1 is rendered for PAUSED/COMPLETED goals at `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:291`
- [x] CA12 completed goal can reopen — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:401`

### Phase 9 — PUL-8 common

- [x] CA13 achievement and completion derive from confirmed only — `shared/src/calculators/savings-goal-progress.ts:177`

## Findings

| Sev         | Kind        | Phase | Location                                                                                             | Issue                                                                                                                                      | Fix                                                                                      |
| ----------- | ----------- | ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 🔴 critical | conform     | 4     | `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.ts:17`                              | Root savings-goal cache is not cleared on logout and keys omit user id, allowing fresh data from the previous account to be reused.        | Clear `SavingsGoalApi` in `AuthCleanupService` and regress logout/login isolation.       |
| 🟡 warning  | functional  | 3     | `ios/Pulpe/Domain/Models/SavingsGoal.swift:88`                                                       | CA19 is partial: UTC serialization can move a locally selected Zurich date to the previous day.                                            | Serialize date-only values in the picker calendar/time zone and use start-of-day bounds. |
| 🟡 warning  | functional  | 8     | `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:291`      | CA11 is partial: D1 says the goal remains active even when status is PAUSED or COMPLETED.                                                  | Render D1 and D2 only for ACTIVE goals.                                                  |
| 🟡 warning  | code        | 3     | `ios/Pulpe/Domain/Store/SavingsGoalStore.swift:54`                                                   | A cancelled load clears the loading state of a newer request and can write a wrapped cancellation error.                                   | Guard all terminal effects by a monotonic generation token.                              |
| 🟡 warning  | code        | 3     | `ios/Pulpe/Features/SavingsGoals/SavingsGoalDetailView.swift:339`                                    | A successful status mutation followed by a failed progress refetch is reported as a failed mutation.                                       | Keep mutation success separate from best-effort refresh failure.                         |
| 🟡 warning  | frontend    | 4     | `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:524`      | Composite view state ignores contributions loading/error and list error, causing empty flashes, silent errors, and false not-found states. | Model all three resources in the loading/error state and retry each failed resource.     |
| 🟡 warning  | fit         | 4     | `frontend/projects/webapp/src/app/feature/current-month/components/dashboard-savings-summary.ts:102` | Monthly savings absence is presented as absence of goals, despite the dashboard card being goal-agnostic.                                  | Keep a generic “Voir mes objectifs” action and let the goal list own its empty state.    |
| 🟡 warning  | frontend    | 4     | `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-card.ts:30`          | Click-only goal cards are not keyboard accessible.                                                                                         | Use a real RouterLink or add focus plus Enter/Space behavior.                            |
| 🟡 warning  | frontend    | 4     | `frontend/projects/webapp/src/app/pattern/savings-goal-picker/savings-goal-picker-field.ts:61`       | Loading and failures collapse to an empty option list, misleading users and blanking an existing selection.                                | Expose loading/error/retry states instead of mapping them to `[]`.                       |
| 🟡 warning  | conform     | 4     | `frontend/projects/webapp/src/app/feature/savings-goals/components/savings-goal-card.ts:34`          | User-entered goal names leak through data-testid and several fields/options lack ph-no-capture.                                            | Use stable ids in test attributes and protect names/amount inputs and picker labels.     |
| 🟡 warning  | performance | 4     | `frontend/projects/webapp/src/app/core/savings-goal/savings-goal-api.ts:42`                          | Budget mutations invalidate the whole savings-goal prefix, refetching the unrelated goal list.                                             | Invalidate progress and contributions prefixes only.                                     |
| 🟡 warning  | conform     | 4     | `frontend/projects/webapp/src/app/feature/savings-goals/services/savings-goals-dialog.service.ts:23` | Feature dialog service is root-scoped against the explicit feature architecture rule.                                                      | Provide it from `savings-goals.routes.ts`.                                               |
| 🟡 warning  | conform     | 3     | `ios/Pulpe/Features/SavingsGoals/SavingsGoalsListView.swift:116`                                     | Goal target amount bypasses the global sensitive-amount masking behavior.                                                                  | Apply `.sensitiveAmount()`.                                                              |
| 🟢 minor    | code        | 4     | `frontend/projects/webapp/src/app/core/savings-goal/savings-goal-api.ts:54`                          | `getById$` has no caller and misrepresents the detail data flow.                                                                           | Remove it.                                                                               |
| 🟢 minor    | code        | 6     | `backend-nest/src/modules/savings-goal/savings-goal-progress.integration.spec.ts:115`                | Current period is captured at module load and can disagree with runtime near a month boundary.                                             | Freeze/inject the clock for the integration test.                                        |
| 🟢 minor    | rot         | 4     | `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:1`        | The new detail page is 667 lines, mixing state orchestration, progress, contribution rendering and mutations.                              | Extract cohesive feature-local presentation components after behavior is stable.         |
| 🟢 minor    | fit         | -     | `frontend/projects/webapp/src/app/core/api/api-client.ts:10`                                         | Global retry behavior changes every GET but is not required by PUL-12/PUL-8.                                                               | Isolate the retry hardening in a dedicated ticket/PR.                                    |

## Verification

| Metric        | Value                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 95% (39/41)                                                                                                                                                                       |
| Files checked | Linear PUL-12, Linear PUL-8, `docs/SAVINGS.md`, 162-file PR diff, GitHub review threads, shared calculator, backend repository/migrations, iOS stores/views, Angular stores/views |
| Unchecked     | PUL-12 CA19 — fix; PUL-8 CA11 — fix                                                                                                                                               |
| Unplanned     | Global GET retry hardening in `frontend/projects/webapp/src/app/core/api/api-client.ts`; local-only simulator commits are outside remote PR head and excluded from this diff      |
