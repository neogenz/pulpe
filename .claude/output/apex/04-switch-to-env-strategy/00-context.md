# APEX Task: 04-switch-to-env-strategy

**Created:** 2026-01-21T11:45:00Z
**Task:** Switch to .env strategy. Follow existing pattern about env naming conventions etc in the project

---

## Configuration

| Flag | Value |
|------|-------|
| Auto mode (`-a`) | false |
| Examine mode (`-x`) | true |
| Save mode (`-s`) | true |
| Test mode (`-t`) | false |
| Economy mode (`-e`) | false |
| Branch mode (`-b`) | false |
| PR mode (`-pr`) | false |
| Interactive mode (`-i`) | false |
| Branch name | N/A |

---

## User Request

```
-x -s please switch to .env strategy. Follow existing pattern about env naming conventions etc in the project
```

---

## Context

The landing page (Next.js) currently uses this pattern for environment-aware URLs:

```typescript
// lib/config.ts
export const ANGULAR_APP_URL =
  process.env.NODE_ENV === 'development' ? 'http://localhost:4200' : ''
```

Documentation research revealed this works but is **not best practice**. The recommended approach is to use `.env.development` and `.env.production` files with `NEXT_PUBLIC_` prefixed variables.

---

## Acceptance Criteria

_To be defined in step-01-analyze.md_

---

## Progress

| Step | Status | Timestamp |
|------|--------|-----------|
| 00-init | ✓ Complete | 2026-01-21T11:45:00Z |
| 01-analyze | ⏸ Pending | |
| 02-plan | ⏸ Pending | |
| 03-execute | ⏸ Pending | |
| 04-validate | ⏸ Pending | |
| 05-examine | ⏸ Pending | |
| 06-resolve | ⏸ Pending | |
| 07-tests | ⏭ Skip | |
| 08-run-tests | ⏭ Skip | |
| 09-finish | ⏭ Skip | |
