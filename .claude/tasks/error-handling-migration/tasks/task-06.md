# Task: Migrate BudgetTemplateService Bulk Operations

## Problem

Bulk operations for template lines use custom error handlers (`handleBulkUpdateError`, `handleBulkOperationsError`) that don't follow the centralized exception pattern. This creates inconsistent error handling for batch operations.

## Proposed Solution

Migrate bulk operation methods to use `BusinessException`:

- `bulkUpdateTemplateLines` → TEMPLATE_LINES_BULK_UPDATE_FAILED (replace handleBulkUpdateError)
- `validateBulkUpdateLines` → TEMPLATE_LINE_NOT_FOUND, TEMPLATE_LINE_TEMPLATE_MISMATCH
- `bulkOperationsTemplateLines` → TEMPLATE_LINES_BULK_OPERATIONS_FAILED (replace handleBulkOperationsError)
- `validateTemplateLinesExist` → TEMPLATE_LINE_NOT_FOUND
- `performBulkUpdates` → TEMPLATE_LINE_NOT_FOUND

Replace calls to custom error handlers with `handleServiceError()`.

## Dependencies

- Task #1: Add Missing ERROR_DEFINITIONS

## Context

- Key file: `backend-nest/src/modules/budget-template/budget-template.service.ts`
- Methods: bulkUpdateTemplateLines (~770-801), validateBulkUpdateLines (~829-849), bulkOperationsTemplateLines (~903-941), validateTemplateLinesExist (~1430-1446), performBulkUpdates (~1448-1496)
- `handleBulkUpdateError` (~818-827) and `handleBulkOperationsError` (~1537-1547) will become unused
- Update related test assertions

## Success Criteria

- All bulk operation methods use BusinessException
- Custom handlers are no longer called (become dead code)
- Tests updated for new exception types
- `pnpm test` passes
