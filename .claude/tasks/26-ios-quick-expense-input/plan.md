# Implementation Plan: iOS Quick Expense Input

## Overview

Add quick expense input functionality to improve speed of transaction entry in the iOS app:
1. Auto-focus amount field when AddTransactionSheet opens (keyboard appears automatically)
2. Numeric keyboard (decimalPad) opens immediately - already implemented in CurrencyField
3. Add preset quick amount buttons (10, 15, 20, 30 CHF) matching Angular webapp

**UX Decisions** (based on Perplexity research):
- Place quick amounts directly below amount field (thumb-friendly, near keyboard)
- Use pill/chip style buttons with secondary visual weight
- REPLACE behavior when tapped (standard for expense apps, not add-to)
- When quick amount selected, auto-advance focus to description field for faster flow

## Dependencies

Files modified in order:
1. `CurrencyField.swift` - Must be modified first (exposes focus binding)
2. `AddTransactionSheet.swift` - Depends on updated CurrencyField

## File Changes

### `ios/Pulpe/Shared/Components/CurrencyField.swift`

**Goal**: Enable external focus control while maintaining backward compatibility.

- **Action 1**: Add optional `externalFocus` parameter to init
  - Type: `Binding<Bool>?` (optional binding, nil by default)
  - Store as private property: `private let externalFocus: Binding<Bool>?`
  - Update init to accept this parameter with default nil

- **Action 2**: Compute effective focus state
  - Add private computed property `effectiveFocus` that returns:
    - External binding's value if provided
    - Internal `isFocused` state otherwise
  - Pattern: `var effectiveFocus: Bool { externalFocus?.wrappedValue ?? isFocused }`

- **Action 3**: Update `.focused()` modifier
  - If external binding provided, use it: `.focused(externalFocus!)`
  - If not provided, use internal: `.focused($isFocused)`
  - Consider: Use a conditional or computed binding approach

- **Action 4**: Update visual styling (line 50)
  - Change `isFocused` to `effectiveFocus` in border color logic
  - Ensures visual feedback works with both internal and external focus

- **Action 5**: Update `updateText()` logic (lines 82, 89)
  - Change `isFocused` checks to `effectiveFocus`
  - Ensures cursor-jump prevention works with external focus

- **Backward Compatibility**: Existing usages without focus parameter continue to work unchanged

### `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`

**Goal**: Add auto-focus and quick amount selection for faster expense entry.

- **Action 1**: Add FocusState for amount field
  - Add `@FocusState private var isAmountFocused: Bool` after other @State properties (around line 14)

- **Action 2**: Add quick amounts constant
  - Add `private let quickAmounts = [10, 15, 20, 30]` after `transactionService` (around line 17)

- **Action 3**: Reorder form sections for better UX
  - Current order: Description → Amount → Type → Date
  - New order: **Amount → Quick Amounts → Description → Type → Date**
  - Move Amount section (lines 36-40) to be first in the Form
  - Rationale: Amount is auto-focused, so it should be visible at top

- **Action 4**: Update CurrencyField to use external focus
  - Pass focus binding: `CurrencyField(value: $amount, placeholder: "0.00", externalFocus: $isAmountFocused)`
  - Or use Binding adapter pattern from Perplexity: create `Binding<Bool>` from FocusState

- **Action 5**: Add Quick Amounts section after Amount section
  - Create new Section with header "Montants rapides"
  - Add HStack with ForEach over quickAmounts
  - Each button:
    - Label: "\(amount) CHF"
    - Style: `.buttonStyle(.bordered)` or `.borderedProminent` for selected state
    - Action: Set `self.amount = Decimal(amount)`, then move focus to description field
  - Layout: HStack with `.frame(maxWidth: .infinity)` for even spacing

- **Action 6**: Add auto-focus on appear
  - Add `.onAppear` modifier to the Form or NavigationStack
  - Use delayed focus for reliable sheet behavior:
    ```
    .onAppear {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            isAmountFocused = true
        }
    }
    ```
  - Delay of 0.2s is safe for iOS 15+ sheet presentation

- **Action 7**: Add focus transition to description after quick amount selection
  - When quick amount button tapped, after setting amount:
    - Set `isAmountFocused = false` to dismiss keyboard
    - Or consider adding a second FocusState for description field to auto-advance
  - Keep it simple initially: just set amount, user taps description manually

- **Consider**: Button visual feedback
  - Option A: Simple `.bordered` style
  - Option B: Track selected amount and highlight the matching button
  - Recommendation: Start with Option A (simpler), enhance later if needed

## Testing Strategy

**Manual Testing Required** (no unit tests for SwiftUI focus behavior):

1. **Auto-focus test**:
   - Open AddTransactionSheet via + button
   - Verify keyboard appears automatically with decimal pad
   - Verify amount field is focused (has accent color border)

2. **Quick amount selection test**:
   - Tap "10 CHF" button
   - Verify amount field shows "10" (or "10.00")
   - Tap "30 CHF" button
   - Verify amount field updates to "30" (replaces, doesn't add)

3. **Full flow test**:
   - Open sheet → keyboard auto-appears
   - Tap "20 CHF" → amount set to 20
   - Type description
   - Select type
   - Submit → transaction created successfully

4. **Backward compatibility test**:
   - Verify CurrencyField still works in EditTransactionSheet (no external focus)
   - Verify CurrencyField still works in EditBudgetLineSheet (no external focus)

5. **Device testing**:
   - Test on iPhone (should show decimal pad)
   - Test on iPad (may show full keyboard - acceptable)

## Documentation

No documentation updates needed - this is a UX enhancement within existing feature.

## Rollout Considerations

- No breaking changes - CurrencyField modification is backward compatible
- No feature flags needed - this is a pure UX improvement
- No migration required
- Immediate availability after merge
