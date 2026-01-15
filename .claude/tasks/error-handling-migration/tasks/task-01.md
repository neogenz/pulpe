# Task: Add Missing ERROR_DEFINITIONS

## Problem

The `error-definitions.ts` file lacks definitions for User module operations and several Template operations. These definitions are prerequisites for migrating existing `InternalServerErrorException`, `NotFoundException`, `BadRequestException`, and `ForbiddenException` usages to the standardized `BusinessException` pattern.

## Proposed Solution

Add 15 new error definitions to `error-definitions.ts`:

**User section (after USER_FETCH_FAILED):**
- USER_PROFILE_UPDATE_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- USER_ONBOARDING_UPDATE_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- USER_ONBOARDING_FETCH_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- USER_SETTINGS_UPDATE_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- USER_SETTINGS_FETCH_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)

**Template section (after TEMPLATE_ONBOARDING_RATE_LIMIT):**
- TEMPLATE_ACCESS_FORBIDDEN (HttpStatus.FORBIDDEN)
- TEMPLATE_LINE_ACCESS_FORBIDDEN (HttpStatus.FORBIDDEN)
- TEMPLATE_LINE_CREATE_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- TEMPLATE_LINE_FETCH_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- TEMPLATE_LIMIT_EXCEEDED (HttpStatus.BAD_REQUEST)
- TEMPLATE_IN_USE (HttpStatus.BAD_REQUEST)
- TEMPLATE_LINES_BULK_UPDATE_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- TEMPLATE_LINES_BULK_OPERATIONS_FAILED (HttpStatus.INTERNAL_SERVER_ERROR)
- TEMPLATE_LINES_VALIDATION_FAILED (HttpStatus.BAD_REQUEST)
- TEMPLATE_LINE_TEMPLATE_MISMATCH (HttpStatus.BAD_REQUEST)

## Dependencies

- None (can start immediately)

## Context

- Key file: `backend-nest/src/common/constants/error-definitions.ts`
- Follow existing patterns for error code naming and structure
- Each definition needs: code, message, and httpStatus

## Success Criteria

- All 15 definitions added following existing naming conventions
- TypeScript compiles without errors
- `pnpm quality` passes in backend-nest
