# Task: Create CurrencyInput Component Tests

## Problem

The CurrencyInput component (`ui/currency-input/currency-input.ts`, 71 lines) has no test coverage. It's a reusable UI component used in the budget creation flow with:
- Signal inputs: label (required), placeholder, currency, required, testId, autoFocus
- Model for two-way binding: value
- Input parsing method: onInput()

## Proposed Solution

Create a test suite `currency-input.spec.ts` covering:
1. Component structure (all inputs and model defined)
2. Default values for optional inputs
3. The `onInput()` method parsing logic
4. Model binding behavior

## Dependencies

- None (fully independent, can be done in parallel with any task)

## Context

- Component uses `model()` for two-way binding (NOT ControlValueAccessor)
- Test pattern: `breadcrumb.spec.ts` - Signal input testing
- TestBed setup with provideZonelessChangeDetection()
- Material imports: FormsModule, MatFormFieldModule, MatInputModule

## Success Criteria

- Test file `currency-input.spec.ts` exists with ~10 tests covering:
  - Component structure (inputs and model defined)
  - Default values (placeholder='0.00', currency='CHF', required=false, etc.)
  - onInput() parsing (valid number, empty string, NaN case, decimals)
  - Model binding (initial null, set updates value)
- All tests pass
- `pnpm test -- currency-input.spec.ts` runs successfully
