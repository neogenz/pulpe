# Task: Migrate BudgetTemplateService Template Validation Methods

## Problem

Template validation methods use generic exceptions for business rule violations. This includes rate limiting, access control, and usage checks. These need standardized error codes for better client handling.

## Proposed Solution

Migrate these validation methods to use `BusinessException`:

- `validateTemplateLimit` → TEMPLATE_FETCH_FAILED (for count error), TEMPLATE_LIMIT_EXCEEDED
- `createFromOnboarding` → TEMPLATE_CREATE_FAILED
- `checkOnboardingRateLimit` → TEMPLATE_ONBOARDING_RATE_LIMIT
- `validateTemplateAccess` → TEMPLATE_NOT_FOUND, TEMPLATE_ACCESS_FORBIDDEN
- `validateTemplateNotUsed` → TEMPLATE_IN_USE

These methods enforce business rules, so the error codes help clients understand what went wrong and how to recover.

## Dependencies

- Task #1: Add Missing ERROR_DEFINITIONS

## Context

- Key file: `backend-nest/src/modules/budget-template/budget-template.service.ts`
- Methods: validateTemplateLimit (~285-303), createFromOnboarding (~372-409), checkOnboardingRateLimit (~411-430), validateTemplateAccess (~1612-1626), validateTemplateNotUsed (~1630-1645)
- Update related test assertions

## Success Criteria

- All validation methods use BusinessException with specific error codes
- Clients receive consistent error codes for business rule violations
- `pnpm test` passes
- `pnpm quality` passes
