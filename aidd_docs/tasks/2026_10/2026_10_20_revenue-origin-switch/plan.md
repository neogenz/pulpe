---
objective: "Creating an income asks « Cet argent vient de mon épargne » then « D'un objectif » / « À remettre » the same way in the prévision and mouvement flows, on iOS, the webapp and Android."
status: pending
---

# Plan: One way to say where an income comes from

## Overview

| Field      | Value                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| **Goal**   | Replace the « Origine » menu and the goal-only toggle with one toggle + 2-option segment     |
| **Source** | [`brainstorm.md`](./brainstorm.md)                                                          |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | iOS: prévision sheet, toggle + segment             | [`phase-1.md`](./phase-1.md) |
| 2   | iOS: mouvement sheet, toggle + segment + routing   | [`phase-2.md`](./phase-2.md) |
| 3   | Webapp: prévision dialog, toggle + segment         | [`phase-3.md`](./phase-3.md) |
| 4   | Webapp: add-transaction form, toggle + routing     | [`phase-4.md`](./phase-4.md) |
| 5   | Android: transaction sheet, toggle + routing       | [`phase-5.md`](./phase-5.md) |
| 6   | Android: prévision sheet gains the income origin   | [`phase-6.md`](./phase-6.md) |

Phases 1-2, 3-4 and 5-6 are independent per platform. Within a platform, the prévision phase lands first because the mouvement phase reuses its copy and its routing target.

## Decisions

| Decision | Why |
| -------- | --- |
| « À remettre » from the accueil navigates to that month's budget page and opens the existing withdrawal sheet there, instead of presenting it over the accueil. | The withdrawal sheet, its mutation and its deficit formula are feature-local to the budget feature on all three platforms (iOS `Features/Budgets`, web `feature/budget` behind eslint boundaries, Android `budget-details/savings-withdrawal`). Navigating reuses all of it with no code move. The user lands where the new Revenu M is visible. |
| The internal `IncomeOrigin` (`regular` / `savingsGoal` / `repayNextMonth`) stays as the state; the toggle and segment are two views over it (toggle off = `regular`). | Keeps every existing rule (pointé gating, goal reset, submit routing) and its tests unchanged; only the control changes. |
| Toggling on selects « D'un objectif » by default. | The goal withdrawal is the non-routing case: the sheet stays in place until the user deliberately picks « À remettre ». |
| Copy never says « avance » nor « emprunt ». | Copy validated in user testing (`ios/.../TightMonthCard.swift`). |
