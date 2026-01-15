# Implementation Plan: NestJS Error Handling Migration

## Overview

Migrate all NestJS generic exceptions (`InternalServerErrorException`, `NotFoundException`, `BadRequestException`, `ForbiddenException`) to the standardized `BusinessException` pattern with proper cause chain preservation and logging context.

**Principle:** "Log or Throw, Never Both" - Services throw `BusinessException`, `GlobalExceptionFilter` handles logging.

## Dependencies

Files must be modified in this order:
1. `error-definitions.ts` - Add missing definitions first
2. `user.controller.ts` - Migrate to use new definitions
3. `budget-template.service.ts` - Large migration with many handlers
4. Test files - Update assertions after each migration

## File Changes

---

### Phase 1: Add Missing ERROR_DEFINITIONS

### `backend-nest/src/common/constants/error-definitions.ts`

Add after line 336 (after USER_FETCH_FAILED):

- Add `USER_PROFILE_UPDATE_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `USER_ONBOARDING_UPDATE_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `USER_ONBOARDING_FETCH_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `USER_SETTINGS_UPDATE_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `USER_SETTINGS_FETCH_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)

Add to Template section (after TEMPLATE_ONBOARDING_RATE_LIMIT):

- Add `TEMPLATE_ACCESS_FORBIDDEN` definition (HttpStatus.FORBIDDEN)
- Add `TEMPLATE_LINE_ACCESS_FORBIDDEN` definition (HttpStatus.FORBIDDEN)
- Add `TEMPLATE_LINE_CREATE_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `TEMPLATE_LINE_FETCH_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `TEMPLATE_LIMIT_EXCEEDED` definition (HttpStatus.BAD_REQUEST)
- Add `TEMPLATE_IN_USE` definition (HttpStatus.BAD_REQUEST)
- Add `TEMPLATE_LINES_BULK_UPDATE_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `TEMPLATE_LINES_BULK_OPERATIONS_FAILED` definition (HttpStatus.INTERNAL_SERVER_ERROR)
- Add `TEMPLATE_LINES_VALIDATION_FAILED` definition (HttpStatus.BAD_REQUEST)
- Add `TEMPLATE_LINE_TEMPLATE_MISMATCH` definition (HttpStatus.BAD_REQUEST)

---

### Phase 2: Migrate UserController

### `backend-nest/src/modules/user/user.controller.ts`

**Imports to add:**
- Import `BusinessException` from `@common/exceptions/business.exception`
- Import `ERROR_DEFINITIONS` from `@common/constants/error-definitions`
- Import `handleServiceError` from `@common/utils/error-handler`

**Imports to remove:**
- Remove `InternalServerErrorException` from `@nestjs/common`

**Method: updateProfile (lines 92-105)**
- Replace catch block with `handleServiceError()` using `ERROR_DEFINITIONS.USER_PROFILE_UPDATE_FAILED`
- Add logging context: `{ operation: 'updateProfile', userId: user.id, entityType: 'User' }`

**Method: performProfileUpdate (lines 107-125)**
- Replace lines 118-122: throw `BusinessException` with `USER_PROFILE_UPDATE_FAILED`
- Include `{ cause: error }` for the supabase error

**Method: completeOnboarding (lines 159-174)**
- Replace catch block with `handleServiceError()` using `ERROR_DEFINITIONS.USER_ONBOARDING_UPDATE_FAILED`
- Add logging context: `{ operation: 'completeOnboarding', userId: user.id }`

**Method: updateOnboardingStatus (lines 176-196)**
- Replace lines 191-195: throw `BusinessException` with `USER_ONBOARDING_UPDATE_FAILED`
- Include `{ cause: error }` for the supabase error

**Method: getCurrentUserData (lines 198-209)**
- Replace lines 202-206: throw `BusinessException` with `USER_FETCH_FAILED`
- Include `{ cause: getUserError }` for the supabase error

**Method: getOnboardingStatus (lines 222-248)**
- Replace lines 230-234: throw `BusinessException` with `USER_FETCH_FAILED` inside try
- Replace catch block (lines 243-247) with `handleServiceError()` using `USER_ONBOARDING_FETCH_FAILED`

**Method: getSettings (lines 261-284)**
- Remove the `if (error instanceof InternalServerErrorException)` check
- Replace catch block with `handleServiceError()` using `USER_SETTINGS_FETCH_FAILED`

**Method: updateSettings (lines 301-338)**
- Replace lines 318-322: throw `BusinessException` with `USER_SETTINGS_UPDATE_FAILED`
- Remove the `if (error instanceof InternalServerErrorException)` check
- Replace catch block with `handleServiceError()` using `USER_SETTINGS_UPDATE_FAILED`

---

### Phase 3: Migrate BudgetTemplateService

### `backend-nest/src/modules/budget-template/budget-template.service.ts`

**Imports to add:**
- Import `BusinessException` from `@common/exceptions/business.exception`
- Import `ERROR_DEFINITIONS` from `@common/constants/error-definitions`
- Import `handleServiceError` from `@common/utils/error-handler`

**Imports to remove:**
- Remove `BadRequestException`, `ForbiddenException`, `InternalServerErrorException`, `NotFoundException` from `@nestjs/common`

**Method: findAll (lines 61-93)**
- Replace line 74: throw `BusinessException` with `TEMPLATE_FETCH_FAILED` and `{ cause: error }`
- Replace catch block (lines 90-92): use `handleServiceError()` with `TEMPLATE_FETCH_FAILED`

**Method: findOne (lines 95-128)**
- Replace line 111: throw `BusinessException` with `TEMPLATE_NOT_FOUND` and `{ id }` details
- Remove catch block's NotFoundException check, use `handleServiceError()` with `TEMPLATE_FETCH_FAILED`

**Method: create (lines 130-164)**
- Remove BadRequestException check, use `handleServiceError()` with `TEMPLATE_CREATE_FAILED`

**Method: createTemplateWithLines (lines 192-231)**
- Replace line 228: throw `BusinessException` with `TEMPLATE_CREATE_FAILED`

**Method: update (lines 233-270)**
- Remove NotFoundException/BadRequestException checks
- Use `handleServiceError()` with `TEMPLATE_UPDATE_FAILED`

**Method: validateTemplateLimit (lines 285-303)**
- Replace line 295: throw `BusinessException` with `TEMPLATE_FETCH_FAILED` for count error
- Replace lines 299-302: throw `BusinessException` with `TEMPLATE_LIMIT_EXCEEDED`

**Method: performTemplateUpdate (lines 305-319)**
- Replace line 317: throw `BusinessException` with `TEMPLATE_NOT_FOUND`

**Method: createFromOnboarding (lines 372-409)**
- Remove BadRequestException check
- Use `handleServiceError()` with `TEMPLATE_CREATE_FAILED`

**Method: checkOnboardingRateLimit (lines 411-430)**
- Replace lines 426-429: throw `BusinessException` with `TEMPLATE_ONBOARDING_RATE_LIMIT`

**Method: findTemplateLines (lines 511-543)**
- Remove NotFoundException check
- Use `handleServiceError()` with `TEMPLATE_LINES_FETCH_FAILED`

**Method: handleTemplateLineError (lines 608-618)**
- Delete this entire method - replace all usages with `handleServiceError()`

**Method: findTemplateLine (lines 637-675)**
- Remove NotFoundException/ForbiddenException checks
- Use `handleServiceError()` with `TEMPLATE_LINE_FETCH_FAILED`

**Method: fetchAndValidateTemplateLine (lines 677-697)**
- Replace line 688: throw `BusinessException` with `TEMPLATE_LINE_NOT_FOUND`
- Replace lines 691-694: throw `BusinessException` with `TEMPLATE_LINE_ACCESS_FORBIDDEN`

**Method: updateTemplateLine (lines 699-732)**
- Replace call to `handleTemplateLineError()` with `handleServiceError()` using `TEMPLATE_LINE_UPDATE_FAILED`

**Method: validateTemplateLineAccess (lines 734-751)**
- Replace line 745: throw `BusinessException` with `TEMPLATE_LINE_NOT_FOUND`
- Replace lines 747-750: throw `BusinessException` with `TEMPLATE_LINE_ACCESS_FORBIDDEN`

**Method: performTemplateLineUpdate (lines 753-768)**
- Replace line 766: throw `BusinessException` with `TEMPLATE_LINE_NOT_FOUND`

**Method: bulkUpdateTemplateLines (lines 770-801)**
- Replace `handleBulkUpdateError()` call with `handleServiceError()` using `TEMPLATE_LINES_BULK_UPDATE_FAILED`

**Method: handleBulkUpdateError (lines 818-827)**
- Delete this entire method

**Method: validateBulkUpdateLines (lines 829-849)**
- Replace line 841: throw `BusinessException` with `TEMPLATE_LINE_NOT_FOUND`
- Replace lines 845-848: throw `BusinessException` with `TEMPLATE_LINE_TEMPLATE_MISMATCH`

**Method: bulkOperationsTemplateLines (lines 903-941)**
- Replace `handleBulkOperationsError()` call with `handleServiceError()` using `TEMPLATE_LINES_BULK_OPERATIONS_FAILED`

**Method: validateTemplateLinesExist (lines 1430-1446)**
- Replace line 1444: throw `BusinessException` with `TEMPLATE_LINE_NOT_FOUND`

**Method: performBulkUpdates (lines 1448-1496)**
- Replace line 1483: throw `BusinessException` with `TEMPLATE_LINE_NOT_FOUND`

**Method: handleBulkOperationsError (lines 1537-1547)**
- Delete this entire method

**Method: deleteTemplateLine (lines 1549-1579)**
- Remove NotFoundException/ForbiddenException checks
- Use `handleServiceError()` with `TEMPLATE_LINE_DELETE_FAILED`

**Method: validateTemplateAccess (lines 1612-1626)**
- Replace line 1623: throw `BusinessException` with `TEMPLATE_NOT_FOUND`
- Replace line 1625: throw `BusinessException` with `TEMPLATE_ACCESS_FORBIDDEN`

**Method: validateTemplateNotUsed (lines 1630-1645)**
- Replace lines 1641-1644: throw `BusinessException` with `TEMPLATE_IN_USE`

**Method: handleTemplateDeletionError (lines 1674-1682)**
- Delete this entire method - callers should use `handleServiceError()`

**Method: handleTemplateUsageError (lines 1739-1746)**
- Delete this entire method - callers should use `handleServiceError()`

**All removed handler methods:** Update their callers to use `handleServiceError()` directly

---

### Phase 4: Remove Custom Error Handlers

### `backend-nest/src/modules/budget-template/budget-template.service.ts`

Methods to delete completely (total: 5):
1. `handleTemplateLineError` (lines 608-618)
2. `handleBulkUpdateError` (lines 818-827)
3. `handleBulkOperationsError` (lines 1537-1547)
4. `handleTemplateDeletionError` (lines 1674-1682)
5. `handleTemplateUsageError` (lines 1739-1746)

Update each call site to use `handleServiceError()` with appropriate ERROR_DEFINITION

---

### Phase 5: Audit Other Services

### `backend-nest/src/modules/transaction/transaction.controller.ts`

**Line 141:** Review `BadRequestException` usage
- Consider migrating to `BusinessException` with `TRANSACTION_VALIDATION_FAILED`
- Low priority - controller validation is acceptable pattern

### `backend-nest/src/modules/transaction/transaction.mappers.ts`

**Lines 50, 62:** `BadRequestException` in mappers
- Consider migrating to `BusinessException` with `TRANSACTION_VALIDATION_FAILED`
- Low priority - mapper validation is acceptable pattern

### `backend-nest/src/modules/budget-line/budget-line.mappers.ts`

**Lines 51, 63:** `BadRequestException` in mappers
- Consider migrating to `BusinessException` with `BUDGET_LINE_VALIDATION_FAILED`
- Low priority - mapper validation is acceptable pattern

### `backend-nest/src/modules/demo/demo.controller.ts`

**Line 92:** `ForbiddenException` in demo controller
- Consider migrating to `BusinessException` with `AUTH_UNAUTHORIZED`
- Low priority - demo-specific logic

**Conforming services (no changes needed):**
- `budget.service.ts` ✅
- `budget-line.service.ts` ✅
- `transaction.service.ts` ✅
- `demo.service.ts` ✅
- `budget.calculator.ts` ✅

---

## Testing Strategy

### Tests to Update After Phase 2:

**File:** `backend-nest/src/modules/user/user.controller.spec.ts` (if exists)
- Update assertions to expect `BusinessException` instead of `InternalServerErrorException`
- Verify error codes match new `ERROR_DEFINITIONS`

### Tests to Update After Phase 3:

**File:** `backend-nest/src/modules/budget-template/budget-template.service.spec.ts`
- Line 12: Keep `InternalServerErrorException` import for backward compatibility tests OR
- Update all `toThrow(InternalServerErrorException)` to `toThrow(BusinessException)`
- Update assertions to check for specific error codes

**File:** `backend-nest/src/modules/budget-template/budget-template.service.deletion.spec.ts`
- Lines 3-5: Update imports
- Lines 94, 130, 133, 151, 154, 172, 298, 316, 319, 337: Update assertions

### Manual Verification:

1. Run `pnpm test` after each phase
2. Run `pnpm quality` before committing
3. Test API endpoints manually to verify error responses

---

## Rollout Considerations

### Breaking Changes

- **Error response format:** Error codes will change from `HTTP_500` to specific codes like `ERR_USER_PROFILE_UPDATE_FAILED`
- **Frontend impact:** If frontend checks specific error codes, coordinate update

### Migration Steps

1. Complete Phase 1 (definitions) and commit
2. Complete Phase 2 (UserController) and test
3. Complete Phase 3 (BudgetTemplateService) - largest change
4. Complete Phase 4 (cleanup handlers)
5. Phase 5 is optional/low priority

### Commit Strategy

- One commit per phase for easier rollback
- Commit message format: `refactor(error-handling): phase X - description`

---

## Summary

| Phase | Files Changed | Complexity | Risk |
|-------|---------------|------------|------|
| 1 | 1 | Low | None |
| 2 | 1 | Medium | Low |
| 3 | 1 | High | Medium |
| 4 | 1 | Low | Low |
| 5 | 4 | Low | None |

**Total estimated changes:**
- ~15 new ERROR_DEFINITIONS
- ~11 exception migrations in UserController
- ~40+ exception migrations in BudgetTemplateService
- ~5 custom handlers to delete
- ~6 low-priority optional migrations
