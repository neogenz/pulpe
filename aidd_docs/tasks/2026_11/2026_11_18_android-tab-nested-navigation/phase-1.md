---
status: done
---

# Instruction: Tab identity independent of the URL

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── app/
        │   └── (main)/(tabs)/_layout.tsx ✏️
        ├── core/
        │   ├── observability/
        │   │   └── analytics.ts ✏️
        │   └── ui/
        │       ├── navigation-bar.tsx ✏️
        │       └── navigation-bar.spec.tsx ✏️
        └── features/
            └── net-worth/
                ├── net-worth-tab.ts ✏️
                └── net-worth-tab.spec.ts ✏️
```

## Test Scope

| Scenario   | Action                                                             | Observable outcome                                  | Actor  |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------------- | ------ |
| Setup      | Segment arrays for today's tree and for the phase-2 tree           | Fixtures cover both                                 | system |
| Happy path | Accueil → Budgets                                                  | One `tab_switched` with `tab: "budgets"`            | system |
| Edge case  | A detail pushed inside the Budgets tab, then back                  | No `tab_switched` (today: `[id]` then `budgets`)    | system |
| Edge case  | `net_worth` flag off while a screen of the Patrimoine tab is shown | Redirect to `/home`; no redirect from any other tab | system |
| Edge case  | Screen name for `budget/[id]` before and after the phase-2 move    | Same string both times (`(main)/budget/[id]`)       | system |
| Edge case  | Bar given routes named `(budgets)` or `budgets`                    | Same icon, testID `tab-budgets`                     | system |

## Tasks to do

### `1)` One tab key, read from the segment under `(tabs)`

> The tab is the segment right after `(tabs)`, parentheses stripped, never the last segment.

1. Add `tabKey(segmentOrRouteName)` beside `NET_WORTH_ROUTE` in `net-worth-tab.ts`: `(budgets)` → `budgets`, `budgets` → `budgets`.
2. `(tabs)/_layout.tsx`: `tab = tabKey(segments[segments.indexOf("(tabs)") + 1])`, undefined when outside the tabs; `captureTabSwitched` only on a defined change; `shouldLeaveNetWorthTab` takes that tab instead of the last segment.
3. `withoutNetWorthTab` and `NavigationBar` (`ICONS`, `getTestID`) look up by `tabKey(route.name)`.

### `2)` Stable screen names

> `useScreenTracking` keeps sending today's names after the move.

1. In `analytics.ts`, drop the `(tabs)` segment and the tab group segment that follows it, except on a tab root where today's value is `(main)/(tabs)/<tab>`; add a spec mapping old tree → new tree segments to the same string.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `tab_switched` carries `home`/`budgets`/`goals`/`templates`/`net-worth` for both trees, fires only on a tab change, testIDs unchanged (`navigation-bar.spec.tsx`, `net-worth-tab.spec.ts`). |
| 2    | For every route file, the screen name computed from the phase-2 segments equals today's.                                                                                                    |
