---
status: done
---

# Instruction: Move detail routes into per-tab stacks

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── app/
        │   ├── (main)/_layout.tsx ✏️
        │   ├── (main)/budget/create.tsx
        │   ├── (main)/budget/plan.tsx
        │   ├── (main)/budget/[id].tsx ❌
        │   ├── (main)/budget/[id]/line/[lineId].tsx ❌
        │   ├── (main)/goal/ ❌
        │   ├── (main)/template/ ❌
        │   ├── (main)/movements.tsx ❌
        │   ├── (main)/to-point.tsx ❌
        │   ├── (main)/settings/ ❌
        │   ├── (main)/post-onboarding.tsx
        │   ├── (main)/(tabs)/_layout.tsx ✏️
        │   ├── (main)/(tabs)/net-worth.tsx
        │   ├── (main)/(tabs)/home.tsx ❌
        │   ├── (main)/(tabs)/budgets.tsx ❌
        │   ├── (main)/(tabs)/goals.tsx ❌
        │   ├── (main)/(tabs)/templates.tsx ❌
        │   ├── (main)/(tabs)/(home,budgets,goals,templates)/_layout.tsx ✅
        │   ├── (main)/(tabs)/(home,budgets,goals,templates)/budget/[id].tsx ✅
        │   ├── (main)/(tabs)/(home,budgets,goals,templates)/budget/[id]/line/[lineId].tsx ✅
        │   ├── (main)/(tabs)/(home,budgets,goals,templates)/goal/[id].tsx ✅
        │   ├── (main)/(tabs)/(home,budgets,goals,templates)/goal/[id]/history.tsx ✅
        │   ├── (main)/(tabs)/(home)/home.tsx ✅
        │   ├── (main)/(tabs)/(home)/movements.tsx ✅
        │   ├── (main)/(tabs)/(home)/to-point.tsx ✅
        │   ├── (main)/(tabs)/(home)/settings/ ✅
        │   ├── (main)/(tabs)/(budgets)/budgets.tsx ✅
        │   ├── (main)/(tabs)/(goals)/goals.tsx ✅
        │   ├── (main)/(tabs)/(templates)/templates.tsx ✅
        │   └── (main)/(tabs)/(templates)/template/[id].tsx ✅
        ├── core/
        │   └── navigation/
        │       └── vault-routing.spec.tsx ✏️
        └── features/
            └── current-month/
                └── components/
                    └── month-page.tsx ✏️
```

## Test Scope

| Scenario   | Action                                                                 | Observable outcome                                                                | Actor  |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| Setup      | `git mv` each file, update spec import paths and the vault-routing map | `pnpm test` and `pnpm quality` green in `android/`, `screen-insets.spec.ts` green | cli    |
| Happy path | Budgets → tap November                                                 | Detail opens, bar visible, Budgets item active, no gap above the bar              | system |
| Happy path | From the detail, tap Accueil then Budgets                              | Back on the November detail, scroll kept                                          | system |
| Edge case  | Re-tap the active Budgets item on a detail                             | Stack pops to the month list (Material re-select)                                 | system |
| Edge case  | Accueil → month hero → line detail → linked goal                       | All three pushed in the Accueil stack; Android back unwinds them in order         | system |
| Edge case  | Line detail FAB, template detail, goal history, settings               | Content and FAB sit right above the bar, not one inset higher                     | system |
| Edge case  | Préférences (Accueil stack) → toggle « Masquer les montants »          | Stays on Préférences; other tabs show masked amounts; their stacks kept           | system |
| Edge case  | A form sheet (`FormModal`) opened from the budget detail               | Covers the bar as before; closing returns to the detail with the bar              | system |
| Edge case  | Android back on a tab root other than Accueil                          | Goes to Accueil (`firstRoute`), then exits                                        | system |

## Tasks to do

### `1)` Per-tab stack layout

> One `Stack` per tab, shared detail routes declared once.

1. Create `(tabs)/(home,budgets,goals,templates)/_layout.tsx`: `Stack`, `headerShown: false`, `contentStyle` background, `unstable_settings` anchors per group (`(home)` → `home`, `(budgets)` → `budgets`, `(goals)` → `goals`, `(templates)` → `templates`).
2. Move `AmountMaskBoundary` from `Tabs.screenLayout` to this `Stack`'s `screenLayout`, per screen, excluding `settings*`, as `(main)/_layout.tsx` does today; `net-worth` keeps its own boundary through `Tabs.screenLayout` restricted to that route. The boundary never wraps a navigator.
3. `(tabs)/_layout.tsx`: `Tabs.Screen` names become `(home)`, `(budgets)`, `(goals)`, `(templates)`, `net-worth`; rewrite the doc comment.

### `2)` Move the routes

> URLs stay identical, so no in-tab `router.push` changes.

1. `git mv` per the tree; keep `budget/create`, `budget/plan`, `post-onboarding` in `(main)`; rewrite the `(main)/_layout.tsx` comment.
2. Update the 25 specs found by `grep -rlE 'app/\(main\)' android/src --include='*.spec.ts*'` and the route map at `core/navigation/vault-routing.spec.tsx:121`.

### `3)` The bar pays the bottom inset

> Moved screens stop adding the bottom inset the bar already pays.

1. Drop `"bottom"` from `SafeAreaView edges` in every moved screen (`settings/*`, `template/[id]`, `goal/[id]`, `goal/[id]/history`, `budget/[id]`, `[lineId]`) and in `month-page.tsx:72,98` if only rendered inside a tab.
2. `[lineId].tsx:428`: FAB `bottom` without `insets.bottom`, using the clearance the tab screens use (`core/ui/fab-clearance`).

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1    | On every moved screen the bar is visible with its tab active; toggling the amount mask keeps every stack where it was.       |
| 2    | Every existing `router.push`/`replace`/`dismissTo` target resolves (no "Unmatched route"); `pnpm test`, `pnpm quality` pass. |
| 3    | `screen-insets.spec.ts` passes; on the emulator no moved screen shows a blank band above the bar.                            |
