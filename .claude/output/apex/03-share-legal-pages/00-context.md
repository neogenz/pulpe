# APEX Task: 03-share-legal-pages

**Created:** 2026-01-21T11:30:00Z
**Task:** Share legal pages between landing and Angular app (prefer Angular originals)

---

## Configuration

| Flag | Value |
|------|-------|
| Auto mode (`-a`) | true |
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
Now, it is possible to use the same legal pages from landing and angular app ?
The original one are in angular app, i prefer use them if possible.
It is possible to do that ?
```

---

## Initial Analysis

### Current State

**Angular app (original - more complete):**
- `frontend/projects/webapp/src/app/feature/legal/components/terms-of-service.ts` - 10 sections
- `frontend/projects/webapp/src/app/feature/legal/components/privacy-policy.ts` - 13 sections
- Uses Material Design typography classes
- Uses Angular RouterLink for internal navigation
- French content, Swiss law references

**Landing page (Next.js - simpler):**
- `landing/app/legal/cgu/page.tsx` - 9 sections (simplified)
- `landing/app/legal/confidentialite/page.tsx` - 9 sections (simplified)
- Uses Tailwind prose styling
- Uses Next.js Link component

### Key Differences
- Angular version is more detailed and comprehensive
- Different CSS class systems (Material vs Tailwind)
- Different routing systems (Angular Router vs Next.js router)
- Same core legal content but Angular has more sections

---

## Acceptance Criteria

- [ ] AC1: Legal content is maintained in a single source of truth
- [ ] AC2: Both apps display identical legal content
- [ ] AC3: Navigation works correctly in both apps
- [ ] AC4: SEO metadata preserved for landing pages

---

## Progress

| Step | Status | Timestamp |
|------|--------|-----------|
| 00-init | ✓ Complete | 2026-01-21T11:30:00Z |
| 01-analyze | ⏸ Pending | |
| 02-plan | ⏸ Pending | |
| 03-execute | ⏸ Pending | |
| 04-validate | ⏸ Pending | |
| 05-examine | ⏸ Pending | |
| 06-resolve | ⏸ Pending | |
| 07-tests | ⏭ Skip | |
| 08-run-tests | ⏭ Skip | |
| 09-finish | ⏭ Skip | |
