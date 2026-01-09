# Task: iOS Quick Expense Input with Auto-Focus and Preset Amounts

## Summary

Add quick expense input functionality to the iOS app's AddTransactionSheet:
1. Auto-focus the amount field when the sheet opens
2. Ensure numeric keyboard (decimalPad) opens automatically
3. Add preset quick amount buttons (10, 15, 20, 30 CHF) like in the Angular webapp

## Codebase Context

### Existing Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift` | Main add transaction sheet | Add FocusState, auto-focus, and preset amounts |
| `ios/Pulpe/Shared/Components/CurrencyField.swift` | Currency input component | Expose focus binding externally |

### CurrencyField Analysis

The `CurrencyField` component (CurrencyField.swift:1-97) already has:
- Internal `@FocusState private var isFocused: Bool` (line 9)
- `.keyboardType(.decimalPad)` applied (line 36)
- `.focused($isFocused)` binding (line 37)
- Visual feedback when focused (accent color border, lines 48-51)

**Key Insight**: CurrencyField manages focus internally. To enable external focus control, we need to expose a `FocusState.Binding<Bool>` parameter so the parent sheet can control focus.

### AddTransactionSheet Analysis

Current structure (AddTransactionSheet.swift):
- Lines 8-14: State properties (name, amount, kind, transactionDate, isLoading, error)
- Line 37: `CurrencyField(value: $amount, placeholder: "0.00")`
- Lines 56-65: DatePicker section
- Lines 86-90: Toolbar with "Annuler" and "Ajouter" buttons

**No FocusState currently** - needs to be added to enable auto-focus.

### Auto-Focus Pattern in Codebase

Reference implementation in `PersonalInfoStep.swift:5,25,39-41`:
```swift
@FocusState private var isFocused: Bool

TextField("Votre prénom", text: ...)
    .focused($isFocused)
    .onAppear {
        isFocused = true
    }
```

### Sheet Presentation Pattern

From `CurrentMonthView.swift:54-68`:
```swift
.sheet(isPresented: $showAddTransaction) {
    if let budgetId = viewModel.budget?.id {
        AddTransactionSheet(budgetId: budgetId) { transaction in
            viewModel.addTransaction(transaction)
        }
    }
}
```

## Documentation Insights

### FocusState Requirements
- Requires iOS 15.0+
- Use `@FocusState` property wrapper with `.focused()` modifier
- For sheets, use `.task` or `.onAppear` with a small delay (0.15-0.5s) for reliable focus

### Keyboard Types
- `.decimalPad`: Best for currency (includes decimal point)
- `.numberPad`: Numbers only (no decimal point)
- Neither has a Return key - consider adding toolbar Done button

### Auto-Focus in Sheets Pattern
```swift
@FocusState private var isAmountFocused: Bool

.onAppear {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
        isAmountFocused = true
    }
}
```

## Research Findings

### Timing Considerations
- iOS 15 requires a delay (0.15s-0.65s) for FocusState to work in sheets
- iOS 16+ more reliable but delay still recommended
- Test on actual devices (simulator may behave differently)

### Quick Amount Selection Pattern
From Angular webapp (`add-transaction-bottom-sheet.ts:119-130`):
```typescript
readonly predefinedAmounts = signal([10, 15, 20, 30]);

@for (amount of predefinedAmounts(); track amount) {
    <button (click)="selectPredefinedAmount(amount)">
        {{ amount }} CHF
    </button>
}
```

Equivalent SwiftUI pattern:
```swift
let quickAmounts = [10, 15, 20, 30]

HStack {
    ForEach(quickAmounts, id: \.self) { amount in
        Button("\(amount) CHF") {
            self.amount = Decimal(amount)
        }
        .buttonStyle(.bordered)
    }
}
```

## Key Files

| Path | Line | Purpose |
|------|------|---------|
| `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift` | 37 | CurrencyField usage to modify |
| `ios/Pulpe/Shared/Components/CurrencyField.swift` | 9 | Internal FocusState to expose |
| `ios/Pulpe/Features/Onboarding/Steps/PersonalInfoStep.swift` | 39-41 | Auto-focus pattern reference |
| `frontend/.../add-transaction-bottom-sheet.ts` | 119-130 | Quick amounts UI reference |

## Patterns to Follow

1. **FocusState Property**: Use `@FocusState` with Boolean binding for single field focus
2. **Delayed Focus**: Use `.onAppear` with `DispatchQueue.main.asyncAfter(deadline: .now() + 0.15)` for reliable sheet focus
3. **Button Style**: Use `.buttonStyle(.bordered)` or tonal style for quick amount buttons
4. **Form Section**: Add quick amounts in a Form section before description field

## Implementation Options

### Option A: Modify CurrencyField (Recommended)
Add optional external `FocusState.Binding<Bool>` parameter to CurrencyField:
```swift
struct CurrencyField: View {
    @Binding var value: Decimal?
    var placeholder: String = "0.00"
    var externalFocus: FocusState<Bool>.Binding? = nil

    @FocusState private var internalFocus: Bool

    private var isFocused: Bool {
        get { externalFocus?.wrappedValue ?? internalFocus }
    }
}
```

### Option B: New CurrencyField Variant
Create `FocusableCurrencyField` that accepts external focus binding.

### Option C: Direct TextField in Sheet
Replace CurrencyField with inline TextField in AddTransactionSheet (not recommended - breaks consistency).

## Dependencies

- No new dependencies required
- Uses existing SwiftUI FocusState (iOS 15+)
- Project already targets iOS 17.0+ (from project.yml)

## Potential Concerns

1. **CurrencyField Modification**: Need to ensure backward compatibility with existing usages that don't need external focus control
2. **iPad Behavior**: Numeric keypad may show full keyboard on iPad - test required
3. **Animation Timing**: May need to adjust delay based on testing

## Next Step

Run `/epct:plan 26-ios-quick-expense-input` to create detailed implementation plan.
