# Implementation: Add Edit Functionality for Budget Entries in iOS App

## Completed

### New Files Created
- `ios/Pulpe/Features/CurrentMonth/Components/EditBudgetLineSheet.swift` - Edit sheet for budget lines with form fields (name, amount, kind, recurrence)
- `ios/Pulpe/Features/CurrentMonth/Components/EditTransactionSheet.swift` - Edit sheet for transactions with form fields (name, amount, kind, date)
- `ios/Pulpe/Features/Templates/TemplateDetails/EditTemplateLineSheet.swift` - Edit sheet for template lines with form fields (name, amount, kind, recurrence)

### Modified Files
- `ios/Pulpe/Features/CurrentMonth/Components/RecurringExpensesList.swift`
  - Added `onEdit` callback to `BudgetSection`
  - Added `onEdit` callback to `BudgetLineRow`
  - Added tap gesture with `.contentShape(Rectangle())` and `.onTapGesture`
  - Added VoiceOver accessibility hints

- `ios/Pulpe/Features/CurrentMonth/Components/OneTimeExpensesList.swift`
  - Added `onEdit` callback to `TransactionSection`
  - Added `onEdit` callback to `TransactionRow`
  - Added tap gesture with accessibility support

- `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift`
  - Added `@State` for `selectedBudgetLineForEdit` and `selectedTransactionForEdit`
  - Added `.sheet(item:)` modifiers for edit sheets
  - Added `onEdit` callbacks to all `BudgetSection` and `TransactionSection` usages
  - Added `updateBudgetLine()` and `updateTransaction()` methods to ViewModel

- `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift`
  - Added `@State` for `selectedBudgetLineForEdit` and `selectedTransactionForEdit`
  - Added `.sheet(item:)` modifiers for edit sheets
  - Added `onEdit` callbacks to all section usages (income, expense, saving, transactions)
  - Added `updateBudgetLine()` and `updateTransaction()` methods to ViewModel

- `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift`
  - Added `@State` for `selectedLineForEdit`
  - Added `.sheet(item:)` modifier for edit sheet
  - Modified `TemplateLineRow` to accept `onEdit` callback
  - Added tap gesture to `TemplateLineRow`
  - Added `updateTemplateLine()` method to ViewModel

## Deviations from Plan

1. **Removed recurrence (frequency) editing** - La fréquence n'est pas éditable selon les specs métier
2. **Added `id` to BudgetLineUpdate DTO** - Le backend exige l'id dans le body du PATCH (schéma Zod)

## Key Implementation Details

### State Initialization in Edit Sheets
Used `State(initialValue:)` in `init()` as recommended in the plan (instead of `.onAppear`) to properly initialize form fields with existing values:
```swift
init(budgetLine: BudgetLine, onUpdate: @escaping (BudgetLine) -> Void) {
    self.budgetLine = budgetLine
    self.onUpdate = onUpdate
    _name = State(initialValue: budgetLine.name)
    _amount = State(initialValue: budgetLine.amount)
    // ...
}
```

### Tap Gesture Coexistence with Long Press
Implemented tap gesture BEFORE long press gesture as SwiftUI handles them naturally:
```swift
.contentShape(Rectangle())
.onTapGesture { onEdit() }
.onLongPressGesture(minimumDuration: 0.4, ...) { ... }
```

### Virtual Rollover Lines Protection
Added guard clauses to prevent editing virtual rollover lines:
```swift
.onTapGesture {
    guard !line.isVirtualRollover else { return }
    onEdit()
}
```

### VoiceOver Accessibility
Added accessibility traits and hints for better screen reader support:
```swift
.accessibilityAddTraits(.isButton)
.accessibilityHint("Toucher pour modifier, maintenir pour voir les transactions")
```

## Test Results

- Typecheck: ✓
- Build: ✓ (xcodebuild succeeded)
- No warnings in production code

## Files Summary

| Type | File | Lines Changed |
|------|------|---------------|
| NEW | `EditBudgetLineSheet.swift` | 135 |
| NEW | `EditTransactionSheet.swift` | 127 |
| NEW | `EditTemplateLineSheet.swift` | 123 |
| MODIFY | `RecurringExpensesList.swift` | +15 |
| MODIFY | `OneTimeExpensesList.swift` | +12 |
| MODIFY | `CurrentMonthView.swift` | +30 |
| MODIFY | `BudgetDetailsView.swift` | +35 |
| MODIFY | `TemplateDetailsView.swift` | +20 |

## Follow-up Tasks

None identified - the feature is complete and ready for testing.

## Manual Testing Checklist

1. **CurrentMonthView - Budget Line Edit**
   - [ ] Tap on a recurring budget line → Edit sheet opens
   - [ ] Verify all fields pre-filled with current values
   - [ ] Modify name, amount, kind, recurrence → Save
   - [ ] Verify line updates in list
   - [ ] Verify cancel dismisses without changes
   - [ ] Verify virtual rollover lines are NOT tappable

2. **CurrentMonthView - Transaction Edit**
   - [ ] Tap on a free transaction → Edit sheet opens
   - [ ] Verify all fields pre-filled (name, amount, kind, date)
   - [ ] Modify values → Save
   - [ ] Verify transaction updates in list

3. **BudgetDetailsView - Budget Line Edit**
   - [ ] Same tests for all sections (income, expense, saving)

4. **BudgetDetailsView - Transaction Edit**
   - [ ] Test free transactions edit

5. **TemplateDetailsView - Template Line Edit**
   - [ ] Tap on any template line → Edit sheet opens
   - [ ] Verify all fields pre-filled
   - [ ] Modify values → Save
   - [ ] Verify line updates in list

6. **Gestures Coexistence**
   - [ ] Tap opens edit sheet immediately
   - [ ] Long press (0.4s) still opens linked transactions sheet
