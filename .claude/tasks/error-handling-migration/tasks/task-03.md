# Task: Migrate BudgetTemplateService Core CRUD Operations

## Problem

The core CRUD methods in `BudgetTemplateService` (findAll, findOne, create, update) use generic NestJS exceptions. This breaks the "Log or Throw, Never Both" principle and creates inconsistent error handling.

## Proposed Solution

Migrate these methods to use `BusinessException`:

- `findAll` → TEMPLATE_FETCH_FAILED with cause chain
- `findOne` → TEMPLATE_NOT_FOUND for missing templates, TEMPLATE_FETCH_FAILED for errors
- `create` → TEMPLATE_CREATE_FAILED
- `createTemplateWithLines` → TEMPLATE_CREATE_FAILED
- `update` → TEMPLATE_UPDATE_FAILED
- `performTemplateUpdate` → TEMPLATE_NOT_FOUND

Replace try-catch blocks with `handleServiceError()` where appropriate. Remove `NotFoundException`, `BadRequestException` checks that are being replaced.

## Dependencies

- Task #1: Add Missing ERROR_DEFINITIONS

## Context

- Key file: `backend-nest/src/modules/budget-template/budget-template.service.ts`
- Methods span approximately lines 61-320
- Update related test assertions in `budget-template.service.spec.ts`

## Success Criteria

- All core CRUD methods use BusinessException
- Tests updated to expect BusinessException with correct error codes
- `pnpm test` passes
- No regression in API behavior (same HTTP status codes)
