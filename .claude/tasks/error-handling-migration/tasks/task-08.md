# Task: (Optional) Audit Remaining Services

## Problem

A few services still use generic NestJS exceptions for validation in controllers and mappers. While this is an acceptable pattern for input validation at system boundaries, migrating them would complete the standardization effort.

## Proposed Solution

Review and optionally migrate:

- `transaction.controller.ts:141` - BadRequestException for validation
- `transaction.mappers.ts:50,62` - BadRequestException in mappers
- `budget-line.mappers.ts:51,63` - BadRequestException in mappers
- `demo.controller.ts:92` - ForbiddenException in demo controller

**Note:** These are low priority. Controller/mapper validation with generic exceptions is acceptable since these are system boundaries. Only migrate if consistency is highly valued.

## Dependencies

- Task #1: Add Missing ERROR_DEFINITIONS

## Context

- These services already conform to the pattern in their core logic
- Validation at boundaries (controllers, mappers) is different from business logic errors
- The plan marks these as "low priority" and "optional"

## Success Criteria

- Decision made on whether to migrate each case
- If migrated: uses appropriate BusinessException
- If not migrated: documented reason for keeping as-is
- `pnpm test` passes
- `pnpm quality` passes
