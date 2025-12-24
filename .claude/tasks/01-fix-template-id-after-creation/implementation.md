# Implementation: Fix template ID undefined after creation

**GitHub Issue:** https://github.com/neogenz/pulpe/issues/116

## Completed

### 1. Fixed API return type
**File:** `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-api.ts`
- Line 37-38: Changed `create$()` return type from `Observable<BudgetTemplateResponse>` to `Observable<BudgetTemplateCreateResponse>`

### 2. Fixed state data access
**File:** `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-state.ts`
- Line 82: Changed `response.data` to `response.data.template` in optimistic update replacement
- Line 86: Changed `return response.data` to `return response.data.template` for navigation

## Deviations from Plan

None - implementation followed the plan exactly.

## Test Results

- **Type verification:** ✓ Confirmed `BudgetTemplateCreateResponse` type from `shared/schemas.ts:524-533` has correct structure `{ data: { template, lines } }`
- **Quality check:** ⚠ Could not run `pnpm quality` due to disk space issue on machine
- **Manual verification recommended:** Create template → Click card without refresh → Verify URL has correct UUID

## Root Cause Summary

The API returns `BudgetTemplateCreateResponse` with structure:
```typescript
{ success: true, data: { template: BudgetTemplate, lines: TemplateLine[] } }
```

But the code was treating it as `BudgetTemplateResponse`:
```typescript
{ success: true, data: BudgetTemplate }
```

This caused `response.data` to be `{ template, lines }` instead of `BudgetTemplate`, resulting in undefined IDs.

## Follow-up Tasks

1. Run `pnpm quality` once disk space is available
2. Manual testing to verify the fix works as expected
