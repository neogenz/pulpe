---
status: done
---

# Instruction: Entries from outside a tab, device pass

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── app/
        │   ├── (main)/budget/create.tsx ✏️
        │   └── (main)/budget/plan.tsx ✏️
        ├── core/
        │   └── linking/
        │       ├── deep-link-router.tsx ✏️
        │       └── deep-link-router.spec.tsx ✏️
        └── features/
            ├── budgets/
            │   └── create-budget-screen.spec.tsx ✏️
            └── budget-details/
                └── components/
                    ├── delete-month-action.tsx ✏️
                    └── delete-month-action.spec.tsx ✏️
```

## Test Scope

| Scenario   | Action                                                                                              | Observable outcome                                                                         | Actor  |
| ---------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| Setup      | Emulator prerequisites per `android/README.md` (JDK 17, `android/.env`, dev build) and demo account | App on Accueil, signed in                                                                  | system |
| Happy path | `adb shell am start -d "pulpe://budget?id=<id>"` while on the Objectifs tab                         | Budgets tab selected, month pushed on its stack, bar visible                               | system |
| Edge case  | Create a budget from Budgets, then from the Accueil empty state                                     | Form closes onto the new month inside the tab that opened it, bar visible, back → tab root | system |
| Edge case  | « Modèles » shortcut in the create form (`dismissTo("/templates")`)                                 | Lands on Modèles tab root, no second tabs navigator                                        | system |
| Edge case  | Delete the month from a detail opened from Accueil                                                  | Lands on Budgets list with « Mois supprimé »; Accueil no longer shows the deleted month    | system |
| Edge case  | Plan months (`dismissTo("/budgets")`)                                                               | Budgets list with the counts, back exits to Accueil                                        | system |
| Edge case  | Accueil « Objectifs » shortcut (`push("/goals")`)                                                   | Switches to the Objectifs tab                                                              | system |
| Teardown   | Recreate the deleted month                                                                          | Demo data back to baseline                                                                 | system |

## Tasks to do

### `1)` Explicit tab for entries from outside a tab

> A navigation that starts outside any tab names its tab, as iOS `openBudgetMonth` does.

1. `deep-link-router.tsx`: push `/(budgets)/budget/<id>`; spec asserts the new href.
2. `create.tsx:161`: replace `router.replace` (the second-tabs-navigator bug `plan.tsx:100` documents) with `dismissTo` the opening tab, then push the month on it; read iOS `BudgetListView` `onCreate` and `HomeNoBudgetView` first to match where the month opens.
3. `delete-month-action.tsx`: after `dismissTo("/budgets")`, make sure no other tab stack still shows the deleted month (pop it, or rely on the detail's not-found state: decide on device).
4. `plan.tsx` and `create.tsx:146` `dismissTo`: verify on device; change only if they misbehave, and update their comments.

### `2)` Device pass and contributor checks

> Prove the journeys on the emulator before review.

1. Bring up the emulator per `android/README.md` (JDK 17 `JAVA_HOME`, `android/.env` from `.env.example`, `pnpm dev:android`), sign in with the demo account; run on an idle machine (today's attempt hung at load 50-70).
2. Run the Test Scope rows of phases 2 and 3; capture Budgets → November with the bar visible.
3. Run the Maestro flows in `android/maestro/` (`check-operation.yaml` taps `budget-row-*`).
4. `cd android && pnpm test && pnpm quality`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Deep link, creation, deletion and planning each land in the right tab with the bar visible and a back path that ends on a tab root. |
| 2    | Every scenario above observed on the emulator; Maestro flows, `pnpm test` and `pnpm quality` green.                                 |
