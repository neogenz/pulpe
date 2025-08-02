# Error Handling Migration Guide

## Problem
Backend tests were failing because services now throw `BusinessException` instead of standard NestJS exceptions (`BadRequestException`, `NotFoundException`, `InternalServerErrorException`), but tests still expect the old exception types.

## Solution Overview
The BusinessException approach is the correct pattern for this codebase because it provides:

1. **Structured Error Handling**: Rich context, error codes, and cause chains
2. **Centralized Error Definitions**: All error messages and HTTP status codes in one place
3. **Better Debugging**: Full error cause chain preservation
4. **Consistent Logging**: Structured logging context for observability

## What Was Implemented

### 1. Enhanced Test Utilities
Created `expectBusinessExceptionThrown` helper in `test-utils-simple.ts`:

```typescript
export const expectBusinessExceptionThrown = async (
  promiseFunction: () => Promise<unknown>,
  expectedErrorDefinition: ErrorDefinition,
  expectedDetails?: Record<string, unknown>,
): Promise<void> => {
  try {
    await promiseFunction();
    throw new Error('Expected function to throw a BusinessException');
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException);
    const businessError = error as BusinessException;
    expect(businessError.code).toBe(expectedErrorDefinition.code);
    expect(businessError.getStatus()).toBe(expectedErrorDefinition.httpStatus);
    
    if (expectedDetails) {
      expect(businessError.details).toEqual(expectedDetails);
    }
  }
};
```

### 2. Updated BudgetService Tests
Fully converted BudgetService tests to use BusinessException patterns:

```typescript
// Before
await expectErrorThrown(
  () => service.findOne(budgetId, mockSupabaseClient),
  NotFoundException,
  'Budget introuvable'
);

// After
await expectBusinessExceptionThrown(
  () => service.findOne(budgetId, mockSupabaseClient),
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id: budgetId }
);
```

## Remaining Work

### Test Files That Need Updates
- `src/modules/transaction/transaction.service.spec.ts` (partially done)
- `src/modules/budget-line/budget-line.service.spec.ts`
- `src/modules/budget-template/budget-template.service.spec.ts`

### Conversion Patterns

#### Import Updates
```typescript
// Add to imports
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { expectBusinessExceptionThrown } from '../../test/test-utils-simple';
```

#### Exception Mapping
| Old Exception | New Error Definition | Use Case |
|---------------|---------------------|----------|
| `NotFoundException` | `*_NOT_FOUND` | Entity not found |
| `BadRequestException` (validation) | `VALIDATION_FAILED` | Input validation |
| `BadRequestException` (missing data) | `REQUIRED_DATA_MISSING` | Required fields |
| `InternalServerErrorException` | `*_FETCH_FAILED` | Database read errors |
| `InternalServerErrorException` | `*_CREATE_FAILED` | Database insert errors |
| `InternalServerErrorException` | `*_UPDATE_FAILED` | Database update errors |
| `InternalServerErrorException` | `*_DELETE_FAILED` | Database delete errors |

#### Example Conversions

**Transaction Not Found:**
```typescript
// Before
await expectErrorThrown(
  () => service.findOne('invalid-id', mockUser, mockClient),
  NotFoundException,
  'Transaction not found'
);

// After
await expectBusinessExceptionThrown(
  () => service.findOne('invalid-id', mockUser, mockClient),
  ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
  { id: 'invalid-id' }
);
```

**Validation Error:**
```typescript
// Before
await expectErrorThrown(
  () => service.create(invalidDto, mockUser, mockClient),
  BadRequestException,
  'Invalid amount'
);

// After
await expectBusinessExceptionThrown(
  () => service.create(invalidDto, mockUser, mockClient),
  ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
  { reason: 'Amount must be greater than 0' }
);
```

**Database Error:**
```typescript
// Before
await expectErrorThrown(
  () => service.findAll(mockClient),
  InternalServerErrorException,
  'Failed to retrieve transactions'
);

// After
await expectBusinessExceptionThrown(
  () => service.findAll(mockClient),
  ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED
);
```

## Current Status
- ✅ Enhanced test utilities with BusinessException support
- ✅ Updated BudgetService tests (all passing)
- ✅ Partially updated TransactionService tests
- ⏳ Remaining: BudgetLineService and BudgetTemplateService tests

## Quick Fix Command
To see remaining failing tests:
```bash
bun test 2>&1 | grep 'fail' | head -20
```

Current status: **258 pass, 30 fail** (down from 56 failures)

## Benefits of This Approach
1. **Type Safety**: Compile-time checking of error definitions
2. **Consistency**: All business exceptions follow the same pattern
3. **Debuggability**: Full error cause chains preserved
4. **Observability**: Rich structured logging context
5. **Maintainability**: Centralized error definitions

## Next Steps
1. Complete conversion of remaining test files using the patterns above
2. Verify all tests pass: `bun test`
3. Remove the migration script and documentation once complete