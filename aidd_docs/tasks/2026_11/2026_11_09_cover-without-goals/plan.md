# « Couvrir avec mon épargne » without goals — plan

## Contract

« Couvrir avec mon épargne » (PUL-292) is an advance: a Revenu in M and an Épargne in M+1 to
put the money back. It never debits a goal (`docs/SAVINGS.md` §11.2). Today the sheet lists
the goals with their balance as sources, which implies a debit that never happens.

Outcome:

1. The sheet no longer lists goals and no longer fetches them. The income is still named
   `prefill.source ?? « Mon épargne »`.
2. Under « D'où vient l'argent ? », a row « Prendre sur un objectif » (subtitle: the goal goes
   down, nothing to put back) hands over to the real goal withdrawal: the budget page's
   movement sheet opened as a Revenu, « Cet argent vient de mon épargne » on, origin « goal »,
   no goal chosen yet (the existing `SavingsGoalPickerField` asks for it), with the amount and
   currency typed in the cover sheet carried over.
3. The row only shows where the host can route it (an optional callback, `nil` hides it).
   The withdrawal is written into the month on screen (M), like every budget-page movement.

iOS only. No backend, shared or web change. Copy is French, product voice.

## Steps

1. `Shared/Components/MovementSheet/MovementSheet.swift`: replace `withdrawalGoalId: String?`
   with an optional start value carrying `goalId: String?`, `amount: Decimal?`,
   `currency: SupportedCurrency?`. When set: kind `.income`, `isFromSavings = true`,
   `savingsOrigin = .goal`, `savingsGoalId = goalId`, and amount / amountText / inputCurrency
   seeded from it (amountText through `Formatters.amountInput(for:)`, as the edit path does).
   Update `App/GoalWithdrawalFlow.swift` to pass `goalId` through it.
2. `Routing/BudgetDetailDestination.swift`: add a destination for the goal withdrawal with its
   amount and currency (stable `id`). `Routing/BudgetDetailSheetContent.swift` shows
   `BudgetMovementSheet` for it; `BudgetMovementSheet` forwards the start value to
   `MovementSheet`.
3. `SavingsWithdrawal/SavingsWithdrawalSheet.swift`: drop `goals`, the fetch in `.task`, the
   `SavingsGoalStore` environment and the `ForEach`; `source` becomes a constant. The source
   card shows « Mon épargne » and, when the new `onTakeFromGoal: ((Decimal?, SupportedCurrency) -> Void)?`
   is set, the « Prendre sur un objectif » row (chevron, `.plainPressedButtonStyle()` +
   `.contentShape`, disabled while submitting). Fix the type doc comment (no more goal
   naming). `BudgetDetailSheetContent` wires it with `router.present(<new destination>)`, the
   same in-slot handover `onSpreadInstead` uses.
4. New catalog keys in `Resources/Localizable.xcstrings` with en/de/it. Remove keys this
   change leaves unused, if any.
5. Tests: one focused test for the start value seeding the movement sheet state if the
   sheet's state is reachable from existing test patterns (look at how
   `withdrawalGoalId` is tested today and extend that); otherwise a pure helper test.

## Constraints

- Files under `Features/Budgets/BudgetDetails` stay ≤ 350 lines; SwiftLint strict.
- No magic design values (`DesignTokens`, `PulpeTypography`).
- No new dependency, no new abstraction beyond the start value.

## Validation

- `xcodegen generate --use-cache`, `swiftlint lint --strict --quiet` from `ios/`.
- Full unit suite on « Pulpe Tests »; read the executed count.
- Simulator: the cover sheet shows no goal list and the row opens the goal withdrawal with
  the amount carried over.
