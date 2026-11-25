---
objective: "At every Dynamic Type size the iOS movement, forecast, template-line and asset sheets and the « Répartition » card fit the screen width without cutting text, and on Android Back closes an open ⋮ menu before leaving the screen."
status: pending
---

# Plan: Grand texte iOS et Retour sur menu Android

Source: three defects reported before epic PUL-376 (movement sheets cut at AX5 since `c9b5bbeb4`, Patrimoine asset sheet and « Répartition » labels cut at AX5, Android Back with a ⋮ menu open leaves the screen)

## Phases

| #   | Phase                          | File                         | Depends on |
| --- | ------------------------------ | ---------------------------- | ---------- |
| 1   | Android menu closes on Back    | [`phase-1.md`](./phase-1.md) | none       |
| 2   | iOS shared form components     | [`phase-2.md`](./phase-2.md) | none       |
| 3   | iOS Patrimoine at large text   | [`phase-3.md`](./phase-3.md) | 2          |

## External sources

| URL | What it settled |
| --- | --------------- |
| https://reactnative.dev/docs/backhandler | Listeners run from the latest registered to the first, and stop at the first one returning true |
| https://github.com/callstack/react-native-paper/blob/v5.15.3/src/components/Menu/Menu.tsx | `handleDismiss` returns `onDismiss?.()`, undefined, so Back falls through to the router |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | Root cause, confirmed in the simulator: the compact `DatePicker` of `TransactionDateSelector` never shrinks, so beside its label at AX5 it widened the whole MovementSheet column past the screen and the ScrollView cut both edges (capture `avant/ios-ax5-clair-nouvelle-depense-1.png`). `ChipFlowLayout` reporting an over-wide row (chips measured `.unspecified`) was a secondary cause | 2 |
| regression | `ChipFlowLayout` is also used by `OnboardingSuggestionGrid`; chips that fit keep their ideal size, only an over-wide chip wraps | 2 |
| regression | `SegmentedPicker` call sites that change at accessibility sizes only: MovementSheet and AddBudgetLineSheet nature and frequency, BudgetListView year, Reconcile `sidePicker`, Onboarding currency and income steps, CurrencySettingView, SavingsOriginToggle, AssetFormSheet « Sens ». `FormTextField(.row)` is also used by EditBudgetLineSheet. `savingsGoalMenuLabel(.row)` backs the goal, « Versée sur », « Dette remboursée » and « Tiré de » pickers. Normal sizes keep the current layout, checked by normal-size captures | 2 |
| architecture | Android: every screen imports `Menu` from `@/core/ui/menu`, enforced by an ESLint `no-restricted-imports` rule | 1 |
| documentation | `ios/DESIGN.md` Segmented Choice and `NetWorthBreakdownCard` entries gain their accessibility-size behaviour | 2, 3 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `.claude/rules/01-standards/no-magic-design-values.md` | New spacing and radii come from `DesignTokens` |
| `ios/CLAUDE.md` shared components | Fix the shared component once rather than each sheet |
| `.claude/rules/03-frameworks-and-libraries/swiftui-hit-areas.md` | Stacked rows keep their 44pt tap target |

