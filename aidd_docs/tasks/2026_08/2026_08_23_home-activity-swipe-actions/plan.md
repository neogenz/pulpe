---
objective: "On the iOS home « Activité » rows, a leftward swipe reveals Modifier and Supprimer; Modifier opens the existing edit page, Supprimer asks before deleting. A vertical pan on any swipeable row always scrolls."
status: implemented
---

# Plan: Home activity swipe actions + ledger scroll fix

## Overview

| Field      | Value                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Give the home « Activité » rows trailing swipe actions (edit, delete with confirmation) and stop the swipe primitive from swallowing vertical scrolls in the budget ledger. |
| **Source** | User feedback 2026-08-23 (two messages): swipe-to-edit/delete on the home activity section; scrolling over the budget-details transaction list sometimes does not take.    |

## Root cause (scroll)

`LeadingSwipeAction` attaches a `DragGesture(minimumDistance: 20)` with `.highPriorityGesture`. `minimumDistance` is radial, so a 20 pt vertical drag on any ledger row (`BudgetLineMixedRow`, `BudgetDetailsFreeTransactionsList`) wins the touch before the scroll view; the guard in `onChanged` only resets the visual offset, the finger scrolls nothing until it lifts and drags again. `simultaneousGesture` lets the vertical scroll view keep vertical pans and the row keep horizontal ones.

## Phases

| #   | Phase                                                     | File                         |
| --- | --------------------------------------------------------- | ---------------------------- |
| 1   | Ledger scroll: swipe gesture no longer claims vertical pans | [`phase-1.md`](./phase-1.md) |
| 2   | Trailing swipe actions on home activity rows              | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                                    | Why                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Modifier » pushes `BudgetDestination.details` then `BudgetLinePushRoute.editTx` on the home stack         | The only edit surface is `EditTransactionPage` inside BudgetDetails; `CurrentMonthStore` already primes `BudgetDetailCache`, so the page opens from cache. No second edit form. |
| A small trailing-swipe modifier outside `List`, one row open at a time                                      | Home rows live in a `ScrollView`/`VStack`; `.swipeActions` needs a `List`. `LeadingSwipeAction` is commit-on-release and single-action, the wrong shape for two buttons.        |
| Delete goes through `CurrentMonthStore.deleteTransaction` behind a `confirmationDialog`, no undo toast      | The store has no soft-delete queue; the confirmation is the safety net the user asked for. Undo parity with BudgetDetails is a separate decision.                                |
