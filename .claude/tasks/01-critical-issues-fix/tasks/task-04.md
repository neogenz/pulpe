# Task: Create Signup Component Tests

## Problem

The Signup component (`signup.ts`, 412 lines) has zero test coverage. It handles critical user registration flow including:
- Custom `passwordsMatchValidator` function
- Form validation (email, password, confirmPassword, acceptTerms)
- `signUp()` method with API call and error handling
- Signal-based state management (isSubmitting, errorMessage, canSubmit)

## Proposed Solution

Create a comprehensive test suite `signup.spec.ts` covering:
1. The standalone `passwordsMatchValidator` function
2. Form validation for all fields
3. The `canSubmit` computed signal behavior
4. The `signUp()` method (success, failure, exception paths)
5. Helper methods (togglePasswordVisibility, clearMessages)

## Dependencies

- **Task 3**: Signup component should be refactored first (OAuth button extracted)
- This ensures tests are written against the final component structure

## Context

- Test pattern: `edit-transaction-form.spec.ts` - Form component testing
- Test utilities: `core/testing/test-utils.ts`
- Mock pattern: `has-budget.guard.spec.ts` - Service mocking with vi.fn()
- Services to mock: AuthApi, Router, Logger
- AAA pattern with Vitest + TestBed + provideZonelessChangeDetection()

## Success Criteria

- Test file `signup.spec.ts` exists with ~20 tests covering:
  - passwordsMatchValidator (4 cases: empty fields, match, mismatch, error setting)
  - Form validation (6 cases: each field's validators)
  - canSubmit computed (3 cases: invalid form, submitting, valid)
  - signUp method (5 cases: invalid form, success, API error, exception, loading state)
  - Helper methods (3 cases)
- All tests pass
- `pnpm test -- signup.spec.ts` runs successfully
