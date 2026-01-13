# Tasks: Google OAuth & Onboarding Improvements

## Overview

Improve the Google OAuth onboarding flow by prefilling user data, adding legal compliance (CGU), fixing routing issues, and adding analytics tracking for funnel conversion.

## Task List

- [ ] **Task 1**: Auth API OAuth Enhancements - `task-01.md`
- [ ] **Task 2**: Profile Prefill from OAuth Metadata - `task-02.md` (depends on Task 1)
- [ ] **Task 3**: OAuth Error Localization - `task-03.md`
- [ ] **Task 4**: Welcome Page & Signup UX Improvements - `task-04.md`
- [ ] **Task 5**: Complete Profile Analytics - `task-05.md` (depends on Task 2)
- [ ] **Task 6**: E2E Tests for Complete Profile Flow - `task-06.md` (depends on Tasks 1-5)

## Execution Order

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Task 1       │────▶│    Task 2       │────▶│    Task 5       │
│ Auth API OAuth  │     │ Profile Prefill │     │ Profile Analytics│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
┌─────────────────┐                                      │
│    Task 3       │ (parallel)                           │
│ Error Localize  │                                      ▼
└─────────────────┘                              ┌─────────────────┐
                                                 │    Task 6       │
┌─────────────────┐                              │   E2E Tests     │
│    Task 4       │ (parallel) ─────────────────▶└─────────────────┘
│ Welcome UX      │
└─────────────────┘
```

### Parallel Execution Options

1. **Tasks 1, 3, 4** can be done in parallel (no dependencies between them)
2. **Task 2** requires Task 1 to be completed first
3. **Task 5** requires Task 2 to be completed first
4. **Task 6** (E2E tests) should be done last after all features are implemented

## Risk Assessment

| Task | Risk Level | Notes |
|------|------------|-------|
| Task 1 | Medium | redirectTo change needs verification with Supabase |
| Task 2 | High | Budget check redirect - test thoroughly to avoid loops |
| Task 3 | Low | Simple error message mapping |
| Task 4 | Low | UI text + analytics additions |
| Task 5 | Low | Analytics only, no core logic changes |
| Task 6 | Low | Tests only, no production code changes |

## Recommended Start

Begin with **Task 1** (foundation) and **Tasks 3 & 4** in parallel to maximize progress.
