# Task: Migrate BudgetTemplateService Template Line Methods

## Problem

Template line operations (find, update, delete individual lines) use generic NestJS exceptions and a custom `handleTemplateLineError` helper. This creates inconsistent error handling and violates the centralized exception handling pattern.

## Proposed Solution

Migrate template line methods to use `BusinessException`:

- `findTemplateLines` → TEMPLATE_LINES_FETCH_FAILED
- `findTemplateLine` → TEMPLATE_LINE_FETCH_FAILED
- `fetchAndValidateTemplateLine` → TEMPLATE_LINE_NOT_FOUND, TEMPLATE_LINE_ACCESS_FORBIDDEN
- `updateTemplateLine` → TEMPLATE_LINE_UPDATE_FAILED (replace handleTemplateLineError call)
- `validateTemplateLineAccess` → TEMPLATE_LINE_NOT_FOUND, TEMPLATE_LINE_ACCESS_FORBIDDEN
- `performTemplateLineUpdate` → TEMPLATE_LINE_NOT_FOUND
- `deleteTemplateLine` → TEMPLATE_LINE_DELETE_FAILED

Replace calls to `handleTemplateLineError()` with `handleServiceError()`.

## Dependencies

- Task #1: Add Missing ERROR_DEFINITIONS

## Context

- Key file: `backend-nest/src/modules/budget-template/budget-template.service.ts`
- Methods span approximately lines 511-768 and 1549-1579
- `handleTemplateLineError` method (~608-618) will become unused after this task
- Update related test assertions in `budget-template.service.deletion.spec.ts`

## Success Criteria

- All template line methods use BusinessException
- `handleTemplateLineError` is no longer called (becomes dead code)
- Tests updated for new exception types
- `pnpm test` passes
