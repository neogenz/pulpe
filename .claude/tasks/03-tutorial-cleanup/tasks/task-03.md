# Task: Extract Tutorial Start Delay Constant

## Problem

The CurrentMonthComponent uses a magic number `800` milliseconds for the tutorial start delay. While the purpose is documented in a comment, the value itself is not a named constant, reducing code clarity and maintainability.

## Proposed Solution

Extract the delay value to a named constant at the top of the file. The constant name should be self-documenting, making the inline comment redundant.

## Dependencies

- None (can be done in parallel with Tasks 1-2)

## Context

- Target file: `feature/current-month/current-month.ts:255-265`
- Current code pattern:
  ```typescript
  setTimeout(() => {
    // ... tutorial start logic
  }, 800); // Delay to allow page to fully render
  ```
- Constant placement: After imports, before class declaration
- Naming convention: `UPPER_SNAKE_CASE` for constants

## Success Criteria

- Constant `TUTORIAL_START_DELAY_MS` defined with value `800`
- setTimeout uses the constant instead of magic number
- Inline comment removed (redundant with constant name)
- JSDoc comment explains the constant's purpose
- App behavior unchanged
