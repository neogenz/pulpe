---
status: done
---

# Instruction: Copy and contrast: budget captions, PIN dots and subtitle

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── app/
        │   └── (main)/(tabs)/budgets.tsx ✏️
        ├── core/
        │   └── i18n/
        │       └── catalogs/
        │           ├── de.json ✏️
        │           ├── en.json ✏️
        │           ├── fr.json ✏️
        │           └── it.json ✏️
        ├── features/
        │   └── budgets/
        │       └── budgets-screen.spec.tsx ✏️
        └── ui/
            ├── pin-pad.spec.tsx ✏️
            └── pin-pad.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | From the repo root: `pnpm install --frozen-lockfile && pnpm --filter pulpe-shared build:esm` | `pnpm --dir android run type-check` runs | cli |
| Happy path | Render the Budgets screen with a current, an upcoming and a closed month | Current row caption « disponible », upcoming « disponible prévu », closed row no caption | cli |
| Edge case | Current month with a negative remaining | Caption is still « disponible » (iOS ignores the sign; the amount colour already says it) | cli |
| Edge case | Budget whose `remaining` is absent | No caption (iOS hides the amount block; Android keeps its amount) | cli |
| Edge case | Closed months unfolded | Closed rows show no caption | cli |
| Happy path | Render `PinPad` with 1 of 4 digits, Pulpe light then dark theme | Empty dots use `theme.colors.onSurface` as border (15.17:1 light, 14.15:1 dark), filled ones keep `primary` | cli |
| Edge case | Real error path: `PinPad` with `value=""` and an `errorMessage` | Android's current error treatment is kept; empty rings in `onSurface` | cli |

## Tasks to do

### `1)` Budget row caption like iOS

> The caption under a month's amount says what the figure is, as `BudgetMonthRow.Role.amountCaption` does on iOS (`ios/Pulpe/Features/Budgets/BudgetList/BudgetListView+Subviews.swift:25`).

1. In `budgets.tsx` (~l.640-650), replace the `isPositive ? potential : adjustment` ternary: when `budget.remaining` is set (not null/undefined): `timing === "current"` → `t("budgets.list.available")`, `timing === "future"` → `t("budgets.list.availablePlanned")`, `"past"` → nothing. No caption when `remaining` is absent. Update the comment above it.
2. In the 4 catalogs, delete `budgets.list.potential` and `budgets.list.adjustment` after checking with `grep -rn` that nothing else reads them; add `available` / `availablePlanned` with the iOS values: fr « disponible » / « disponible prévu », en « available » / « planned available », de « verfügbar » / « geplant verfügbar », it « disponibile » / « disponibile previsto ».
3. In `budgets-screen.spec.tsx`, assert the caption for current positive, current negative, upcoming, closed (unfolded) and absent `remaining`.

### `2)` PIN dots readable, subtitle like iOS

> Empty PIN slots reach 3:1 against the background like iOS `PinDotsView.swift:18-19` (ring in the primary text colour), and the subtitle says what to do.

1. In `pin-pad.tsx` (~l.65), empty dot `borderColor: theme.colors.onSurface` instead of `outlineVariant`.
2. In the 4 catalogs, `vault.unlock.subtitle` takes the iOS string of `PinEntryView.swift:98`: fr « Saisis ton code pour ouvrir ton budget. », en « Enter your code to open your budget. », de « Gib deinen Code ein, um dein Budget zu öffnen. », it « Inserisci il tuo codice per aprire il tuo budget. ».
3. In `pin-pad.spec.tsx`, assert the empty dot border is `onSurface` under the Pulpe light and dark themes, filled dots keep `primary`, and the real error state (`value=""` + `errorMessage`) keeps Android's current error treatment.
4. Verify: `pnpm --dir android run quality`, `pnpm --dir android exec jest src/features/budgets src/ui src/core/i18n`, `pnpm test:lexicon` from the root. Do not commit; report the changed files.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Captions show only for current or upcoming months with `remaining` set, regardless of sign: « disponible » for the current month, « disponible prévu » for upcoming ones; none for closed months or an absent `remaining` |
| 1 | No catalog keeps `budgets.list.potential` or `budgets.list.adjustment`; the 4 catalogs keep identical key sets |
| 2 | Empty PIN rings use `onSurface`, including after an error resets the value; filled dots keep their existing colors and the error message remains visible |
| 2 | The unlock screen subtitle reads « Saisis ton code pour ouvrir ton budget. » in French |
