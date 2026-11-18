---
status: done
---

# Instruction: Budget line row (separate point target, large text) and 48dp targets

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── core/
        │   └── ui/
        │       ├── section-header.spec.tsx ✅
        │       ├── section-header.tsx ✏️
        │       ├── segmented-picker.spec.tsx ✅
        │       └── segmented-picker.tsx ✏️
        └── features/
            └── budget-details/
                └── components/
                    ├── budget-line-row.spec.tsx ✅
                    └── budget-line-row.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | From the repo root: `pnpm install --frozen-lockfile && pnpm --filter pulpe-shared build:esm` | Jest runs | cli |
| Happy path | Render `BudgetLineRow` for a pointable line | The checkbox (`PointCircle`, role checkbox) and the open button (role button) are siblings, not nested; each press fires its own handler | cli |
| Edge case | Line planned from a savings goal (`sourceSavingsGoalId` set) | The decorative disc stays inside the open area; no checkbox; the row opens | cli |
| Edge case | Swipe in progress (`SwipeToPoint` guard) | Neither tap fires during a swipe, as today | cli |
| Happy path | `BudgetLineRow` at font scale 1 | Amount beside the labels, title 2 lines max, metadata 1 line, as today | cli |
| Edge case | `BudgetLineRow` at font scale 1.5 | Amount stacked under the labels on one line; title and metadata unlimited | cli |
| Happy path | Render `SegmentedPicker` | Each segment has `hitSlop` top and bottom `SPACING.xs` (40 + 8 = 48dp); visual height unchanged | cli |
| Happy path | Render `SectionHeader` with a link | The link button content has `minHeight: TOUCH_TARGET`; pressing it calls `onPress` | cli |

## Tasks to do

### `1)` Budget line row: separate point target, readable at large text

> TalkBack reaches the point checkbox and the row separately, as `PointRow` already allows (`point-row.tsx:52-62`), and at accessibility text sizes the row stacks its amount and frees its labels, as `BudgetLineMixedRow.swift:80,96` does on iOS (`stacksAmount = dynamicTypeSize.isAccessibilitySize`).

1. In `budget-line-row.tsx` (~l.91-125), put the `PointCircle` and the open `Pressable` side by side in a row `View` inside `SwipeToPoint`'s child. Keep `guard(onPress)` and `guard(onToggle) ?? onToggle`, the ripple on the open part, and the disc on the same rail. For a goal-planned line (not pointable), keep the decorative disc inside the open `Pressable` so the whole row still opens.
2. Read `useWindowDimensions().fontScale`; at or above a named constant `1.5` (one-line comment: Android threshold chosen for accessibility text sizes, to validate on a narrow screen; no exact equivalence with iOS AX1), stack the amount under the labels on one line and drop `numberOfLines` on title and metadata. Below it, keep today's layout.
3. New `budget-line-row.spec.tsx`: roles are siblings (checkbox not a descendant of the button), each press calls its handler, goal-planned line renders no checkbox and still opens, layout at font scale 1 and 1.5 (mock `useWindowDimensions`). Drive the `SwipeToPoint` callbacks and assert that neither tap handler fires during the drag.

### `2)` 48dp touch targets

> Segments and section-header links reach the 48dp target `android/DESIGN.md:99` states.

1. `segmented-picker.tsx`: `hitSlop={{ top: SPACING.xs, bottom: SPACING.xs }}` on each segment `Pressable` (the track's 4dp padding hosts it).
2. `section-header.tsx`: give the link `Button` `contentStyle` a `minHeight: TOUCH_TARGET` (merge with the existing `row-reverse`), accepting a slightly taller header if needed. Fix the comment that claims 48. The two links to look at on a device afterwards: « Afficher/Masquer » in Budgets and « Tout voir » on Accueil.
3. New `segmented-picker.spec.tsx` and `section-header.spec.tsx`: the hitSlop / minHeight props and the press action.
4. Verify: `pnpm --dir android run quality`, `pnpm --dir android exec jest`, `pnpm test:lexicon` from the root. Do not commit; report the changed files.
5. Device checks, done by the orchestrator after the executor: on Android, both TalkBack actions of a budget line work independently; the stacked amount and labels stay readable on a narrow screen at font scales 1.5 and 2; the effective 48dp targets hold, including taps in the segments' top and bottom padding.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | In the budget detail, the checkbox and the row are two separate accessible targets; tapping the disc points, tapping the row opens it; a goal-planned row opens from its whole width |
| 1 | At font scale ≥ 1.5 the amount stacks under the labels and the title is not cut; at 1 the row is unchanged |
| 2 | Segments and section-header links each offer a 48dp touch target |
