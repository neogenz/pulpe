# Step 02: Plan

**Task:** Fix budget detail panel bugs (400 error on add transaction + delete button not working)
**Started:** 2026-01-19T21:16:00.000Z

---

## Implementation Plan

### Overview

Two minimal fixes required: (1) align Zod schema datetime format, (2) add missing event binding. Both are single-line changes with no side effects.

### Prerequisites
- None

---

### File Changes

#### 1. `shared/schemas.ts` (Bug 1 Fix)

**Location:** Line 260
**Change:** Add `{ offset: true }` to `checkedAt` field in `transactionCreateSchema`

```typescript
// Before (line 260):
checkedAt: z.iso.datetime().nullable().optional(),

// After:
checkedAt: z.iso.datetime({ offset: true }).nullable().optional(),
```

**Rationale:**
- Response schema (`transactionSchema:248`) uses `z.iso.datetime({ offset: true })`
- Create schema must accept same format to allow passing `checkedAt` from existing data
- This aligns with the existing pattern for `transactionDate` at line 258

---

#### 2. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts` (Bug 2 Fix)

**Location:** Template lines 162-176 (inside `<pulpe-budget-items>` bindings)
**Change:** Add `(deleteTransaction)` event binding

```html
<!-- Add this line alongside other event bindings: -->
(deleteTransaction)="handleDeleteItem($event)"
```

**Rationale:**
- `BudgetItemsContainer` already declares `deleteTransaction = output<string>()`
- `handleDeleteItem(id: string)` method already exists and handles both budget lines and transactions
- Just need to connect the output to the handler

---

### Testing Strategy

**Manual Testing:**
1. Navigate to budget details page
2. Open a budget line detail panel (click on envelope)
3. Test "Add Transaction":
   - When parent budget line is CHECKED → should work without 400 error
   - When parent budget line is UNCHECKED → should also work
4. Test "Delete Transaction":
   - Click delete button → should open confirmation dialog
   - Confirm → transaction should be removed

**No new unit tests required** - existing functionality is being connected, not new behavior added.

---

### Acceptance Criteria Mapping

- [x] **AC1:** Adding a transaction from detail panel works → Fixed by `shared/schemas.ts` change
- [x] **AC2:** Budget details refresh correctly after adding → No change needed (already works when API succeeds)
- [x] **AC3:** Delete transaction button works → Fixed by `budget-details-page.ts` change
- [x] **AC4:** No regression → Changes are minimal and isolated

---

### Risks & Considerations

| Risk | Mitigation |
|------|------------|
| Schema change affects other consumers | Only affects `checkedAt` which is optional - existing callers sending `null` or omitting field are unaffected |
| Delete handler behavior | Reusing `handleDeleteItem()` which shows confirmation dialog - safe pattern |

---

## Plan Summary

| File | Change Type | Lines Affected |
|------|-------------|----------------|
| `shared/schemas.ts` | Modify | 1 |
| `budget-details-page.ts` | Modify | 1 |

**Total:** 2 files, 2 lines changed

---

## Step Complete

**Status:** ✓ Complete
**Files planned:** 2
**Tests planned:** 0 (manual verification)
**Next:** step-03-execute.md
**Timestamp:** 2026-01-19T21:16:30.000Z
