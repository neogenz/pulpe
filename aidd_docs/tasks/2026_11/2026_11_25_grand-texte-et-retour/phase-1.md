---
status: pending
---

# Instruction: Android menu closes on Back

## Architecture projection

```txt
.
├── android/eslint.config.js ✏️
├── android/src/core/ui/menu.tsx ✅
├── android/src/core/ui/menu.spec.tsx ✅
├── android/src/app/(main)/budget/plan.tsx ✏️
├── android/src/app/(main)/(tabs)/(templates)/template/[id].tsx ✏️
├── android/src/app/(main)/(tabs)/(home,budgets,goals,templates)/goal/[id].tsx ✏️
├── android/src/app/(main)/(tabs)/(home,budgets,goals,templates)/budget/[id]/line/[lineId].tsx ✏️
├── android/src/features/net-worth/components/asset-group-card.tsx ✏️
├── android/src/features/budget-details/components/budget-detail-overlays.tsx ✏️
└── android/src/features/budget-details/components/delete-month-action.tsx ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | JDK 17, a dedicated emulator and Metro on their own ports, local backend and demo account; open a screen with a ⋮ menu | Screen shown, menu closed | system |
| Happy path | Open the ⋮ menu, press Back | Menu closes, the screen stays | system |
| Edge case  | Press Back again with the menu closed | The screen is left as before | system |

## Tasks to do

### `1)` Shared menu

> One `Menu` that consumes Back while it is open.

1. Wrap Paper's `Menu`, register a `hardwareBackPress` listener while `visible`, call `onDismiss` and return true.
2. Point the seven screens at `@/core/ui/menu`.
3. Forbid importing `Menu` from `react-native-paper` outside the wrapper.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | Back with the menu open closes it and the router listener is not called; a second Back reaches the router |
