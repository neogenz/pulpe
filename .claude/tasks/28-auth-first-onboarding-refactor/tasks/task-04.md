# Task: Delete Old Onboarding Feature

## Problem

The old 9-step onboarding feature is no longer used after the auth-first refactor. It contains ~2000 lines of code across 15+ files that are now dead code.

## Proposed Solution

Delete the entire `feature/onboarding/` directory, including:
- All step components (welcome, registration, income, housing, etc.)
- Onboarding store and state management
- Onboarding-specific guards and layout
- All related test files

## Dependencies

- **Task 3:** Routes must be updated first (no references to onboarding routes)
- Must verify no remaining imports reference onboarding

## Context

### Directory to delete:
`frontend/projects/webapp/src/app/feature/onboarding/`

### Files included:
- `onboarding.routes.ts`
- `onboarding-store.ts` + specs
- `onboarding-state.ts`
- `onboarding-step-guard.ts`
- `onboarding-layout.ts`
- `index.ts`
- `steps/` directory (9 components)
- `ui/` directory (if exists)

### Verification needed:
- No imports referencing `feature/onboarding` elsewhere
- No route references to onboarding paths

## Success Criteria

- [ ] `feature/onboarding/` directory completely deleted
- [ ] No TypeScript compilation errors
- [ ] No broken imports in other files
- [ ] `pnpm quality` passes
