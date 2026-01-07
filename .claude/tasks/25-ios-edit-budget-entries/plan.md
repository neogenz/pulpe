# Implementation Plan: Add Edit Functionality for Budget Entries in iOS App

## Overview

Add the ability to edit budget lines, transactions, and template lines by **tapping on rows** in three iOS views:
- **CurrentMonthView** - Edit budget lines and transactions
- **BudgetDetailsView** - Edit budget lines and transactions
- **TemplateDetailsView** - Edit template lines

**Approach**: Create Edit sheets following the existing Add sheets pattern. Modify section components to accept an `onEdit` callback and add tap gesture to rows.

## Dependencies

**Order of implementation:**
1. Edit Sheets (independent - can be done first)
2. ViewModels update methods (depend on services which already exist)
3. Section components (depend on Edit sheets)
4. Parent views (connect everything)

**Existing services that support updates (no changes needed):**
- `BudgetLineService.updateBudgetLine(id:data:)` - `ios/Pulpe/Domain/Services/BudgetLineService.swift:30-33`
- `TransactionService.updateTransaction(id:data:)` - `ios/Pulpe/Domain/Services/TransactionService.swift:30-33`
- `TemplateService.updateTemplateLine(id:data:)` - `ios/Pulpe/Domain/Services/TemplateService.swift:72-74`

## File Changes

---

### `ios/Pulpe/Features/CurrentMonth/Components/EditBudgetLineSheet.swift` (NEW)

**Purpose**: Sheet for editing an existing budget line

- Create new file based on `AddBudgetLineSheet.swift` pattern
- Accept `budgetLine: BudgetLine` prop (the line to edit)
- Accept `onUpdate: (BudgetLine) -> Void` callback
- Initialize form state from `budgetLine` values in `.onAppear`
- Form fields: name (TextField), amount (CurrencyField), kind (Picker), recurrence (Picker)
- Add recurrence Picker (unlike Add sheet which hardcodes `.oneOff`)
- Navigation title: "Modifier la prévision"
- Toolbar buttons: "Annuler" (cancel), "Enregistrer" (confirm)
- Call `BudgetLineService.shared.updateBudgetLine()` with `BudgetLineUpdate` DTO
- Dismiss and call `onUpdate` with updated line on success
- Pattern: Follow `AddBudgetLineSheet.swift:1-113`

---

### `ios/Pulpe/Features/CurrentMonth/Components/EditTransactionSheet.swift` (NEW)

**Purpose**: Sheet for editing an existing transaction

- Create new file based on `AddTransactionSheet.swift` pattern
- Accept `transaction: Transaction` prop (the transaction to edit)
- Accept `onUpdate: (Transaction) -> Void` callback
- Initialize form state from `transaction` values in `.onAppear`
- Form fields: name (TextField), amount (CurrencyField), kind (Picker), transactionDate (DatePicker)
- Navigation title: "Modifier la transaction"
- Toolbar buttons: "Annuler" (cancel), "Enregistrer" (confirm)
- Call `TransactionService.shared.updateTransaction()` with `TransactionUpdate` DTO
- Dismiss and call `onUpdate` with updated transaction on success
- Pattern: Follow `AddTransactionSheet.swift:1-126`

---

### `ios/Pulpe/Features/Templates/TemplateDetails/EditTemplateLineSheet.swift` (NEW)

**Purpose**: Sheet for editing an existing template line

- Create new file similar to other edit sheets
- Accept `templateLine: TemplateLine` prop
- Accept `onUpdate: (TemplateLine) -> Void` callback
- Initialize form state from `templateLine` values in `.onAppear`
- Form fields: name (TextField), amount (CurrencyField), kind (Picker), recurrence (Picker)
- Navigation title: "Modifier la ligne"
- Toolbar buttons: "Annuler" (cancel), "Enregistrer" (confirm)
- Call `TemplateService.shared.updateTemplateLine()` with `TemplateLineUpdate` DTO
- Dismiss and call `onUpdate` with updated line on success
- Pattern: Follow `AddBudgetLineSheet.swift` structure

---

### `ios/Pulpe/Features/CurrentMonth/Components/RecurringExpensesList.swift`

**Purpose**: Add edit callback and tap gesture to `BudgetSection` and `BudgetLineRow`

#### BudgetSection component (lines 4-89)
- Add new prop: `let onEdit: (BudgetLine) -> Void`
- Pass `onEdit` to `BudgetLineRow`
- Update Preview to include `onEdit: { _ in }`

#### BudgetLineRow component (lines 93-244)
- Add new prop: `let onEdit: () -> Void`
- Wrap the entire VStack content in `.contentShape(Rectangle())`
- Add `.onTapGesture { onEdit() }` to the VStack
- Keep existing `.onLongPressGesture` for linked transactions view
- Consider: Only enable tap for non-rollover lines (`!line.isVirtualRollover`)

---

### `ios/Pulpe/Features/CurrentMonth/Components/OneTimeExpensesList.swift`

**Purpose**: Add edit callback and tap gesture to `TransactionSection` and `TransactionRow`

#### TransactionSection component (lines 4-75)
- Add new prop: `let onEdit: (Transaction) -> Void`
- Pass `onEdit` to `TransactionRow`
- Update Preview to include `onEdit: { _ in }`

#### TransactionRow component (lines 78-131)
- Add new prop: `let onEdit: () -> Void`
- Wrap the HStack in `.contentShape(Rectangle())`
- Add `.onTapGesture { onEdit() }` to the HStack

---

### `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift`

**Purpose**: Add edit state and sheets, connect to section callbacks

#### View state (around line 6-11)
- Add: `@State private var selectedBudgetLineForEdit: BudgetLine?`
- Add: `@State private var selectedTransactionForEdit: Transaction?`

#### Sheets (after line 96)
- Add sheet for `selectedBudgetLineForEdit`:
  ```
  .sheet(item: $selectedBudgetLineForEdit) { line in
      EditBudgetLineSheet(budgetLine: line) { updatedLine in
          Task { await viewModel.updateBudgetLine(updatedLine) }
      }
  }
  ```
- Add sheet for `selectedTransactionForEdit`:
  ```
  .sheet(item: $selectedTransactionForEdit) { transaction in
      EditTransactionSheet(transaction: transaction) { updatedTransaction in
          Task { await viewModel.updateTransaction(updatedTransaction) }
      }
  }
  ```

#### BudgetSection usage (lines 124-143, 148-167)
- Add `onEdit` parameter to both BudgetSection calls:
  ```
  onEdit: { line in
      selectedBudgetLineForEdit = line
  }
  ```

#### TransactionSection usage (lines 172-181)
- Add `onEdit` parameter:
  ```
  onEdit: { transaction in
      selectedTransactionForEdit = transaction
  }
  ```

---

### `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift` (ViewModel)

**Purpose**: Add update methods to `CurrentMonthViewModel`

#### Add updateBudgetLine method (after deleteBudgetLine, around line 348)
- Signature: `func updateBudgetLine(_ line: BudgetLine) async`
- Skip virtual rollover lines
- Optimistic update: find and replace line in `budgetLines` array
- Call `budgetLineService.updateBudgetLine()` with `BudgetLineUpdate` DTO
- On success: reload data to sync with server
- On error: rollback to original state, set error

#### Add updateTransaction method (after deleteTransaction, around line 331)
- Signature: `func updateTransaction(_ transaction: Transaction) async`
- Optimistic update: find and replace transaction in `transactions` array
- Call `transactionService.updateTransaction()` with `TransactionUpdate` DTO
- On success: reload data to sync with server
- On error: rollback to original state, set error

---

### `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift`

**Purpose**: Add edit state and sheets, connect to section callbacks

#### View state (around line 6-8)
- Add: `@State private var selectedBudgetLineForEdit: BudgetLine?`
- Add: `@State private var selectedTransactionForEdit: Transaction?`

#### Sheets (after line 66)
- Add sheet for `selectedBudgetLineForEdit` (same pattern as CurrentMonthView)
- Add sheet for `selectedTransactionForEdit` (same pattern as CurrentMonthView)

#### BudgetSection usage (lines 83-102, 107-126, 131-150)
- Add `onEdit` parameter to all three BudgetSection calls (income, expense, saving)

#### TransactionSection usage (lines 155-164)
- Add `onEdit` parameter

---

### `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift` (ViewModel)

**Purpose**: Add update methods to `BudgetDetailsViewModel`

#### Add updateBudgetLine method (after deleteBudgetLine, around line 299)
- Same pattern as CurrentMonthViewModel.updateBudgetLine

#### Add updateTransaction method (after deleteTransaction, around line 273)
- Same pattern as CurrentMonthViewModel.updateTransaction

---

### `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift`

**Purpose**: Add edit state, sheet, and tap gesture for template lines

#### View state (around line 4-5)
- Add: `@State private var selectedLineForEdit: TemplateLine?`

#### Sheet (after line 29)
- Add sheet for `selectedLineForEdit`:
  ```
  .sheet(item: $selectedLineForEdit) { line in
      EditTemplateLineSheet(templateLine: line) { updatedLine in
          Task { await viewModel.updateTemplateLine(updatedLine) }
      }
  }
  ```

#### TemplateLineRow in templateLineSection (lines 92-105)
- Modify to pass `onEdit` callback to TemplateLineRow
- Alternative: Add `.onTapGesture` directly on ForEach item

#### TemplateLineRow component (lines 110-128)
- Add prop: `var onEdit: (() -> Void)? = nil`
- Wrap HStack in `.contentShape(Rectangle())`
- Add `.onTapGesture { onEdit?() }` if onEdit is provided

---

### `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift` (ViewModel)

**Purpose**: Add update method to `TemplateDetailsViewModel`

#### Add updateTemplateLine method (after loadDetails, around line 179)
- Signature: `func updateTemplateLine(_ line: TemplateLine) async`
- Optimistic update: find and replace line in `lines` array
- Call `templateService.updateTemplateLine()` with `TemplateLineUpdate` DTO
- On success: reload data
- On error: rollback, set error

---

## Testing Strategy

### Manual Verification Steps

1. **CurrentMonthView - Budget Line Edit**
   - Tap on a recurring budget line → Edit sheet opens
   - Verify all fields pre-filled with current values
   - Modify name, amount, kind, recurrence → Save
   - Verify line updates in list
   - Verify cancel dismisses without changes

2. **CurrentMonthView - Transaction Edit**
   - Tap on a free transaction → Edit sheet opens
   - Verify all fields pre-filled (name, amount, kind, date)
   - Modify values → Save
   - Verify transaction updates in list

3. **BudgetDetailsView - Budget Line Edit**
   - Same tests as CurrentMonthView
   - Test for all sections (income, expense, saving)

4. **BudgetDetailsView - Transaction Edit**
   - Test free transactions edit

5. **TemplateDetailsView - Template Line Edit**
   - Tap on any template line → Edit sheet opens
   - Verify all fields pre-filled
   - Modify values → Save
   - Verify line updates in list

6. **Edge Cases**
   - Virtual rollover lines should NOT be editable (no tap reaction)
   - Loading state shown during save
   - Error displayed if API call fails
   - Cancel should dismiss without API call

### Unit Tests (Optional - not required for MVP)
- No unit tests needed for views (SwiftUI Preview covers visual verification)
- API services already tested

---

## Documentation

No documentation changes needed - this is a feature enhancement to existing functionality.

---

## Rollout Considerations

- **No breaking changes**: All changes are additive
- **No migration needed**: Uses existing API endpoints
- **Backwards compatible**: Old app versions still work with same API
- **Feature flag**: Not needed - feature is fully contained

---

## Summary of Changes

| Type | File | Action |
|------|------|--------|
| NEW | `EditBudgetLineSheet.swift` | Create edit sheet for budget lines |
| NEW | `EditTransactionSheet.swift` | Create edit sheet for transactions |
| NEW | `EditTemplateLineSheet.swift` | Create edit sheet for template lines |
| MODIFY | `RecurringExpensesList.swift` | Add onEdit callback and tap gesture |
| MODIFY | `OneTimeExpensesList.swift` | Add onEdit callback and tap gesture |
| MODIFY | `CurrentMonthView.swift` | Add edit states, sheets, update methods |
| MODIFY | `BudgetDetailsView.swift` | Add edit states, sheets, update methods |
| MODIFY | `TemplateDetailsView.swift` | Add edit state, sheet, tap gesture, update method |

**Total: 3 new files, 5 modified files**
