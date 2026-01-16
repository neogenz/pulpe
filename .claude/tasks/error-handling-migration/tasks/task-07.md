# Task: Remove Deprecated Error Handlers and Cleanup

## Problem

After migrating all methods to use `BusinessException` and `handleServiceError()`, several custom error handler methods remain as dead code. These need to be removed for codebase cleanliness.

## Proposed Solution

Delete these 5 deprecated methods from `BudgetTemplateService`:

1. `handleTemplateLineError` (~lines 608-618)
2. `handleBulkUpdateError` (~lines 818-827)
3. `handleBulkOperationsError` (~lines 1537-1547)
4. `handleTemplateDeletionError` (~lines 1674-1682)
5. `handleTemplateUsageError` (~lines 1739-1746)

Also remove any now-unused imports (`BadRequestException`, `ForbiddenException`, `InternalServerErrorException`, `NotFoundException` from `@nestjs/common`).

## Dependencies

- Task #3: Migrate BudgetTemplateService Core CRUD Operations
- Task #4: Migrate BudgetTemplateService Template Validation Methods
- Task #5: Migrate BudgetTemplateService Template Line Methods
- Task #6: Migrate BudgetTemplateService Bulk Operations

## Context

- Key file: `backend-nest/src/modules/budget-template/budget-template.service.ts`
- Verify no remaining calls to these handlers before deletion
- Line numbers may shift after previous tasks

## Success Criteria

- All 5 deprecated handlers deleted
- No unused imports remain
- TypeScript compiles without errors
- `pnpm test` passes
- `pnpm quality` passes
