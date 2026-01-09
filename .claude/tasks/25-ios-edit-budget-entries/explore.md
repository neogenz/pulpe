# Task: Add Edit Functionality for Budget Entries in iOS App

## Summary

Add the ability to edit entries in three iOS views:
1. **CurrentMonthView** - Edit budget lines (recurring/one-time expenses) and transactions
2. **BudgetDetailsView** - Edit budget lines
3. **TemplateDetailView** - Edit template lines

## Codebase Context (iOS)

### Views to Modify

| View | Path | Purpose |
|------|------|---------|
| CurrentMonthView | `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:1-356` | Main budget view with expenses lists |
| RecurringExpensesList | `ios/Pulpe/Features/CurrentMonth/Components/RecurringExpensesList.swift:1-321` | Recurring budget lines with swipe actions |
| OneTimeExpensesList | `ios/Pulpe/Features/CurrentMonth/Components/OneTimeExpensesList.swift` | One-time expenses and transactions |
| BudgetDetailsView | `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift:1-307` | Budget details with all line types |
| TemplateListView | `ios/Pulpe/Features/Templates/TemplateList/TemplateListView.swift` | Template list (need to find detail view) |

### Existing Services (API Ready)

| Service | Path | Methods |
|---------|------|---------|
| BudgetLineService | `ios/Pulpe/Domain/Services/BudgetLineService.swift:30-33` | `updateBudgetLine(id, update)` - PATCH /budget-lines/{id} |
| TransactionService | `ios/Pulpe/Domain/Services/TransactionService.swift:30-33` | `updateTransaction(id, update)` - PATCH /transactions/{id} |

**Important**: The API methods already exist! No backend work needed.

### Models with Update DTOs

#### BudgetLineUpdate (`ios/Pulpe/Domain/Models/BudgetLine.swift:73-80`)
```swift
struct BudgetLineUpdate: Codable {
    let id: String
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var recurrence: TransactionRecurrence?
}
```

#### TransactionUpdate (`ios/Pulpe/Domain/Models/Transaction.swift:65-72`)
```swift
struct TransactionUpdate: Codable {
    let id: String
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var transactionDate: Date?
    var category: String?
}
```

### Existing Creation Sheets (Patterns to Follow)

| Sheet | Path | Purpose |
|-------|------|---------|
| AddBudgetLineSheet | `ios/Pulpe/Features/Budgets/BudgetDetails/AddBudgetLineSheet.swift:1-113` | Create budget line |
| AddTransactionSheet | `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift:1-126` | Create free transaction |
| AddAllocatedTransactionSheet | `ios/Pulpe/Features/Budgets/BudgetDetails/AddAllocatedTransactionSheet.swift:1-128` | Create allocated transaction |

### Reusable Components

| Component | Path | Purpose |
|-----------|------|---------|
| CurrencyField | `ios/Pulpe/Shared/Components/CurrencyField.swift:1-159` | CHF amount input |
| ErrorBanner | `ios/Pulpe/Shared/Components/ErrorView.swift:32-64` | Inline error display |
| LoadingOverlay | `ios/Pulpe/Shared/Extensions/View+Extensions.swift:34-39` | Loading indicator |

## API Endpoints (from Angular Frontend)

### Budget Lines - PATCH /budget-lines/{id}
**Source**: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line-api/budget-line-api.ts:48-61`

**Editable fields**:
- `name` (string)
- `amount` (number)
- `kind` ('expense' | 'income' | 'saving')
- `recurrence` ('fixed' | 'one_off')
- `isManuallyAdjusted` (boolean) - set to true when user edits

### Transactions - PATCH /transactions/{id}
**Source**: `frontend/projects/webapp/src/app/core/transaction/transaction-api.ts:48-55`

**Editable fields**:
- `name` (string)
- `amount` (number)
- `kind` ('expense' | 'income' | 'saving')
- `transactionDate` (ISO string)
- `category` (string | null)

**Note**: `budgetLineId` is NOT editable via update

### Template Lines - POST /budget-templates/{templateId}/lines/bulk-operations
**Source**: `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-api.ts:83-91`

**Bulk operations payload**:
```typescript
{
  create: TemplateLineCreate[],
  update: TemplateLineUpdateWithId[],
  delete: string[]
}
```

**Per-line editable fields**:
- `name`, `amount`, `kind`, `recurrence`, `description`

## SwiftUI Best Practices Research

### Recommended Pattern: Sheet-based Editing

Based on research, the iOS app already follows best practices:
- **Sheet presentation** for modal forms (not navigation)
- **@Observable** macro for ViewModels (iOS 17+)
- **@State** for form fields in sheets
- **Optimistic updates** with rollback on error

### Edit Sheet Structure (Pattern from Add Sheets)

```swift
struct EditBudgetLineSheet: View {
    let budgetLine: BudgetLine  // Original data
    var onUpdate: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var amount: Decimal = 0
    @State private var kind: TransactionKind = .expense
    @State private var isLoading = false
    @State private var error: String?

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        amount > 0 &&
        !isLoading
    }

    var body: some View {
        NavigationStack {
            Form {
                // Form sections
            }
            .navigationTitle("Modifier la prévision")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") { updateBudgetLine() }
                        .disabled(!canSubmit)
                }
            }
            .loadingOverlay(isLoading)
        }
        .onAppear { initializeForm() }
    }
}
```

### Trigger Edit: Swipe Action or Tap

Option 1: **Swipe action** (consistent with delete)
```swift
.swipeActions(edge: .leading) {
    Button {
        selectedLineForEdit = line
    } label: {
        Label("Modifier", systemImage: "pencil")
    }
    .tint(.blue)
}
```

Option 2: **Tap on row** (more discoverable)
```swift
.onTapGesture {
    selectedLineForEdit = line
}
```

**Recommendation**: Use **tap on row** for edit (most intuitive), keep swipe for delete/toggle.

## Key Files

### iOS Files to Create
- `ios/Pulpe/Features/CurrentMonth/Components/EditBudgetLineSheet.swift` - Edit budget line form
- `ios/Pulpe/Features/CurrentMonth/Components/EditTransactionSheet.swift` - Edit transaction form
- `ios/Pulpe/Features/Templates/TemplateDetails/EditTemplateLineSheet.swift` - Edit template line form

### iOS Files to Modify
- `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift` - Add edit state and sheet
- `ios/Pulpe/Features/CurrentMonth/Components/RecurringExpensesList.swift` - Add edit trigger
- `ios/Pulpe/Features/CurrentMonth/Components/OneTimeExpensesList.swift` - Add edit trigger
- `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift` - Add edit state and sheet
- `ios/Pulpe/Features/Templates/` - Need to explore template detail view

## Patterns to Follow

### 1. Sheet State Management
```swift
// In parent view
@State private var selectedLineForEdit: BudgetLine?

// Sheet binding
.sheet(item: $selectedLineForEdit) { line in
    EditBudgetLineSheet(budgetLine: line) { updatedLine in
        // Update local state
    }
}
```

### 2. Optimistic Update Pattern
```swift
func updateBudgetLine(_ update: BudgetLineUpdate) async {
    // 1. Save original state
    let original = budgetLines

    // 2. Optimistic update
    if let index = budgetLines.firstIndex(where: { $0.id == update.id }) {
        budgetLines[index].name = update.name ?? budgetLines[index].name
        // ... other fields
    }

    // 3. API call
    do {
        let updated = try await BudgetLineService.shared.updateBudgetLine(update.id, update)
        // Update with server response
    } catch {
        // 4. Rollback on error
        budgetLines = original
        self.error = error.localizedDescription
    }
}
```

### 3. Form Initialization
```swift
.onAppear {
    name = budgetLine.name
    amount = budgetLine.amount
    kind = budgetLine.kind
}
```

## Dependencies

- iOS 17+ (already required - uses @Observable)
- Existing services: BudgetLineService, TransactionService
- Existing components: CurrencyField, ErrorBanner, LoadingOverlay

## Questions to Clarify

1. **Edit trigger UX**: Tap on row vs swipe action vs both?
   - **Recommendation**: Tap on row (most discoverable)

2. **Fields to allow editing**:
   - Budget lines: name, amount, kind, recurrence?
   - Transactions: name, amount, kind, date, category?
   - **Recommendation**: All fields except `budgetLineId` for transactions

3. **Template lines**: Should edits be individual or batched like Angular?
   - **Recommendation**: Individual for simplicity (iOS pattern)

## Next Steps

1. Run `/workflow:epct:plan 25-ios-edit-budget-entries` to create implementation plan
