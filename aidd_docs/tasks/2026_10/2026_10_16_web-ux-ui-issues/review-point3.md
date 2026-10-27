# Review: announced withdrawal points through the « Pointé » toggle

- **Verdict**: approve
- **Diff**: `HEAD...working-tree` (point 3 files only)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_16
- **Findings**: 0 critical, 1 warning, 3 minor

## Phases

### Phase 1 — Toggle ON realizes the withdrawal

- [x] Web: ON creates a pointed income for the remainder, line `checkedAt` untouched — `budget-items-container.ts` (`#toggleWithdrawalRealization`, `#realizeWithdrawal`), `budget-items-container.spec.ts` "pointing an announced withdrawal (PUL-329 v2)"
- [x] Web: server refusal falls back to the prefilled dialog with goal context — `budget-items-container.spec.ts` (fallback test)
- [x] Web: toggle shows pointed once realizations cover the planned amount — `budget-item-data-provider.spec.ts` (`isPointed` 0 / 200 / 500)
- [x] Web: browser check, demo account, 200 CHF line: balance -400 → -200, checked income linked to goal, line `checked_at` null
- [x] iOS: ON creates the remainder with `isChecked: true` under sync — `BudgetDetailsCoordinator+PlannedWithdrawal.swift`, `PlannedWithdrawalPointTests.swift`
- [x] iOS: failure shows a toast and opens the realization form — `BudgetDetailsCoordinator+PlannedWithdrawal.swift`, `BudgetDetailsView+Routing.swift:23`
- [x] iOS: disc releases its completion state when sync ends unpointed — `PointCircle.swift:172-174` (`finishCompletion` guarded by `isCompleting`)
- [x] iOS: pointed state derived from coverage — `BudgetLine.swift` (`isPointed(allocated:)`), `FiltersStore.swift`

### Phase 2 — Toggle OFF deletes after confirmation

- [x] Web: single realization → confirmation, then delete; decline keeps it — `budget-items-container.spec.ts`, browser check (cancel keeps toggle on, confirm leaves 0 rows)
- [x] Web: 2+ realizations open the allocated list — `budget-items-container.spec.ts`
- [x] Web: cancel label « Garder le retrait » in 4 catalogs, message under `ph-no-capture` — `budget-details-dialog.service.ts`, `confirmation-dialog.ts`, `i18n/{fr,en,de,it}.json`
- [x] iOS: single realization → alert, destructive soft-delete; 2+ → line detail — `PlannedWithdrawalUndoAlert.swift`, `SyncStateStore.swift`, `PlannedWithdrawalPointTests.swift`
- [x] iOS: alert hides the amount under `amountsHidden` — `PlannedWithdrawalUndoAlert.swift`, `Localizable.xcstrings`

### Phase 3 — Partial amount path and contracts kept

- [x] Add-transaction restored on withdrawal lines (partial realization) — `actions-cell.ts`, `budget-action-menu.ts`, `budget-grid-mobile-card.ts`, `budget-detail-panel.ts`, `BudgetLineDetailPage.swift`
- [x] `budgetLine.withdrawalRealized` kept for the goal withdrawals list — `goal-withdrawals-list.ts:326`
- [x] e2e page object follows the new entry point — `frontend/e2e/pages/budget-details.page.ts`
- [x] Business rule documented — `docs/SAVINGS.md` §11.6
- [ ] e2e run — not run locally (port 4200 held by a foreign process, `reuseExistingServer: false`); left to CI

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| warning | rot | - | whole diff | Point 3 is ~+320 net LOC (web ~+45, iOS ~+276 of which ~+157 tests), past the 300 LOC stop line | Accept as is (tests are most of it) or split iOS into its own PR |
| minor | functional | 3 | `BudgetLineDetailPage.swift`, `actions-cell.ts` | Add-transaction stays offered on a fully realized withdrawal, so a user can realize more than announced | Hide add-transaction once `allocated >= amount`, or let the server cap it |
| minor | fit | 1 | `BudgetDetailsScreenState.swift:171`, `BudgetDetailsCoordinator.swift:221` | Checking tip and check-all still skip withdrawal lines although they now point like any line | Decide product-side; drop the `isPlannedSavingsWithdrawal` exclusion if the tip should cover them |
| minor | fit | 2 | `PlannedWithdrawalUndoAlert.swift` | iOS OFF uses an alert then the soft-delete undo toast; web uses a dialog with no undo | Keep (platform idiom) or align later |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 94% (17/18) |
| Files checked | budget-items-container.{ts,spec.ts}, budget-item-data-provider.spec.ts, budget-detail-panel.{ts,spec.ts}, actions-cell.ts, budget-action-menu.ts, budget-grid-mobile-card.ts, budget-details-dialog.service.ts, confirmation-dialog.ts, i18n/{fr,en,de,it}.json, e2e/pages/budget-details.page.ts, SAVINGS.md, BudgetLine.swift, FiltersStore.swift, BudgetDetailsCoordinator{,+PlannedWithdrawal}.swift, SyncStateStore.swift, PlannedWithdrawalUndoAlert.swift, BudgetDetailsView{,+Routing}.swift, BudgetLineMixedRow.swift, BudgetLineDetailPage.swift, PointCircle.swift, Localizable.xcstrings, PlannedWithdrawalPointTests.swift, AddAllocatedTransactionRealizationTests.swift, MockTransactionService.swift |
| Unchecked     | e2e run — not-applicable locally, CI |
| Unplanned     | `confirmation-dialog.ts` `ph-no-capture` applies to every confirmation (privacy gain, intended) |
