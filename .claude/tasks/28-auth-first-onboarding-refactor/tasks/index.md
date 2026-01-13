# Tasks: Auth-First Onboarding Refactor

## Overview

Transform the 9-step non-authenticated onboarding into a streamlined auth-first flow:
- `/welcome` → `/login` (or Google OAuth) → `/app/complete-profile` → `/app/current-month`

**Scope:** ~400 lines new code, ~2000 lines deleted, 8 files modified

---

## Task List

- [ ] **Task 1**: Create Welcome Page Feature - `task-01.md`
- [ ] **Task 2**: Update Routing Constants - `task-02.md`
- [ ] **Task 3**: Update App Routes and Auth Guards - `task-03.md` *(depends on 1, 2)*
- [ ] **Task 4**: Delete Old Onboarding Feature - `task-04.md` *(depends on 3)*
- [ ] **Task 5**: Update Login Page Reference and Final Cleanup - `task-05.md` *(depends on 4)*
- [ ] **Task 6**: Add Unit Tests for Welcome Page - `task-06.md` *(depends on 1)*

---

## Execution Order

```
┌─────────────────┐     ┌─────────────────┐
│   Task 1        │     │   Task 2        │
│ Create Welcome  │     │ Update Routes   │
│    Feature      │     │   Constants     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    ┌──────────────────┘
         │    │
         ▼    ▼
┌─────────────────┐
│   Task 3        │
│ Update Routes   │
│  and Guards     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Task 4        │
│ Delete Old      │
│  Onboarding     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Task 5        │
│ Final Cleanup   │
└─────────────────┘

         ┌─────────────────┐
         │   Task 6        │  ← Can run after Task 1
         │ Unit Tests      │
         └─────────────────┘
```

### Parallel Execution Options

1. **Tasks 1 + 2** can be done in parallel (no dependencies)
2. **Task 6** can be done after Task 1 (independent of 2-5)

### Sequential Requirements

- Task 3 requires Tasks 1 and 2
- Task 4 requires Task 3
- Task 5 requires Task 4

---

## Quick Start

Start with **Task 1** (Create Welcome Page) or **Task 2** (Update Routing Constants) - both can begin immediately.

To execute a specific task:
```
/epct:code .claude/tasks/28-auth-first-onboarding-refactor/tasks/task-01.md
```

---

## Validation

After all tasks complete, run:
```bash
pnpm quality    # Type-check, lint, format
pnpm test       # Unit tests
pnpm dev        # Manual verification
```

### Manual Test Checklist

- [ ] Navigate to `/` → redirects to `/welcome`
- [ ] Click "Continuer avec Google" → OAuth flow works
- [ ] Click "Utiliser mon email" → navigates to `/login`
- [ ] Demo mode works correctly
- [ ] Login page "Créer un compte" → navigates to `/welcome`
- [ ] Unauthenticated `/app/*` → redirects to `/welcome`
