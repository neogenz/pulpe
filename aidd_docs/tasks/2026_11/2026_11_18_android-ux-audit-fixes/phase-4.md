---
status: done
---

# Instruction: Remove the quick amount chips from the entry sheets

## Architecture projection

```txt
.
└── android/
    ├── maestro/
    │   └── add-operation.yaml ✏️
    └── src/
        ├── core/
        │   ├── i18n/
        │   │   └── catalogs/
        │   │       ├── de.json ✏️
        │   │       ├── en.json ✏️
        │   │       ├── fr.json ✏️
        │   │       └── it.json ✏️
        │   └── ui/
        │       ├── quick-amount-chips.spec.tsx ❌
        │       └── quick-amount-chips.tsx ❌
        └── features/
            ├── budget-details/
            │   └── components/
            │       ├── budget-line-sheet.spec.tsx ✏️
            │       └── budget-line-sheet.tsx ✏️
            └── transactions/
                └── components/
                    ├── transaction-sheet.spec.tsx ✏️
                    └── transaction-sheet.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Dependencies installed and `pulpe-shared` built | Jest runs | cli |
| Happy path | Open the movement sheet and the prevision sheet | Amount field alone, no quick amount chips | cli |
| Edge case | Reset after a save, then type a new amount | The amount field remounts empty and accepts typed input as before | cli |
| Edge case | Maestro `add-operation.yaml` | Types `15` in the amount field instead of tapping `quick-amount-15` | cli |

## Tasks to do

### `1)` Same entry sheets as iOS

> Product decision (Maxime, 2026-11-18): Android has the same forms as iOS. iOS `MovementSheet`, `AddBudgetLineSheet` and `EditBudgetLineSheet` use the amount field alone; `QuickAmountChips.swift` appears only in `CreateTemplateView.swift`.

1. Remove `QuickAmountChips` from `transaction-sheet.tsx` and `budget-line-sheet.tsx`, with their imports and any state or handler that only served the chips. Keep manual entry and the amount field's remount on reset.
2. Delete `android/src/core/ui/quick-amount-chips.tsx` and `quick-amount-chips.spec.tsx` with `git rm` (never `rm -rf`), after `grep -rn` shows no other user.
3. Remove `common.quickAmountAccessibility` from the 4 catalogs; keep identical key sets.
4. Drop the chip mocks and assertions in `transaction-sheet.spec.tsx` and `budget-line-sheet.spec.tsx`; keep a test that typing an amount still works.
5. In `android/maestro/add-operation.yaml` (~l.31), replace the tap on `quick-amount-15` by typing `15` into the amount field (reuse the field's existing testID or text selector from the same flow or another flow).
6. Verify: `pnpm --dir android run quality`, `pnpm --dir android exec jest`, `pnpm test:lexicon` from the root. Do not commit.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | No entry sheet shows quick amount chips; `grep -rn "QuickAmount\|quick-amount\|quickAmountAccessibility" android/` returns nothing |
| 1 | Typing an amount, saving and resetting behave as before |
