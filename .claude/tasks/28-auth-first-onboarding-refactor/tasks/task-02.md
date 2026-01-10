# Task: Update Routing Constants

## Problem

The routing constants file contains references to onboarding step paths that will no longer exist after the refactor. A new `WELCOME` route constant is needed for the new welcome page.

## Proposed Solution

Update `routes-constants.ts` to:
- Add `WELCOME: 'welcome'` constant
- Remove all onboarding step constants (`ONBOARDING_WELCOME`, `ONBOARDING_PERSONAL_INFO`, etc.)
- Keep `ONBOARDING: 'onboarding'` temporarily (for guard update in next task)
- Remove corresponding page titles for deleted routes

## Dependencies

- None (can be done in parallel with Task 1)
- Must be completed before Task 3 (routing update)

## Context

- **File:** `core/routing/routes-constants.ts`
- **Constants to remove:** Lines 12-21 (onboarding step paths)
- **Titles to remove:** Lines 38-45 (onboarding step titles)
- **Keep:** `WELCOME: 'Bienvenue'` already exists in `PAGE_TITLES`

### Current constants to remove:
```
ONBOARDING_WELCOME, ONBOARDING_PERSONAL_INFO, ONBOARDING_income,
ONBOARDING_HOUSING, ONBOARDING_HEALTH_INSURANCE, ONBOARDING_PHONE_PLAN,
ONBOARDING_TRANSPORT, ONBOARDING_LEASING_CREDIT, ONBOARDING_REGISTRATION
```

## Success Criteria

- [ ] `ROUTES.WELCOME` constant exists with value `'welcome'`
- [ ] All `ONBOARDING_*` step constants removed
- [ ] `ROUTES.ONBOARDING` kept (for guard migration)
- [ ] Corresponding `PAGE_TITLES` entries removed
- [ ] TypeScript compiles without errors
