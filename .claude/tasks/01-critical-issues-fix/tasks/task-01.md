# Task: Create Auth Constants File

## Problem

The password minimum length validation uses a magic number `8` hardcoded in two places:
- `signup.ts:320` - `Validators.minLength(8)`
- `login.ts:204` - `Validators.minLength(8)`

This violates DRY principle and makes future changes error-prone.

## Proposed Solution

Create a shared constants file in `core/auth/` to centralize auth-related constants. This follows the existing pattern used by `core/routing/routes-constants.ts`.

## Dependencies

- None (foundation task, can start immediately)

## Context

- Pattern reference: `core/routing/routes-constants.ts`
- Export pattern: `core/auth/index.ts` barrel exports
- Constants needed: `PASSWORD_MIN_LENGTH = 8`

## Success Criteria

- New file `core/auth/auth-constants.ts` exists with PASSWORD_MIN_LENGTH export
- Barrel export updated in `core/auth/index.ts`
- TypeScript compiles without errors
