# Step 01: Analyze

**Task:** Corriger les bugs du budget-detail-panel: erreur 400 lors de l'ajout de transaction + bouton delete non fonctionnel
**Started:** 2026-01-19T21:10:30.000Z

---

## Context Discovery

### Keywords Extracted
- **Domain terms**: budget, transaction, checkedAt, detail-panel
- **Technical terms**: POST /api/v1/transactions, Zod validation, datetime format
- **Bug indicators**: 400 error, invalid ISO datetime, delete button

### Investigation Focus
1. How `onAddTransaction` is called and what payload is built
2. How `onDeleteTransaction` is supposed to work
3. Zod schema for transaction creation (checkedAt field)
4. The budget container/facade that provides these callbacks

---

---

## Findings

### Bug 1: checkedAt 400 Error

**Root Cause:** Schema mismatch between create and response schemas

| Schema | File:Line | Definition | Format |
|--------|-----------|------------|--------|
| `transactionSchema` (response) | `shared/schemas.ts:248` | `z.iso.datetime({ offset: true })` | `2026-01-19T10:30:00+01:00` |
| `transactionCreateSchema` (request) | `shared/schemas.ts:260` | `z.iso.datetime()` | `2026-01-19T10:30:00Z` only |

**Flow:**
1. Parent budget line has `checkedAt: "2026-01-19T10:30:00+01:00"` (with offset)
2. `BudgetDetailsStore.createAllocatedTransaction()` at line 349 sends `checkedAt: inheritedCheckedAt`
3. Backend validates against `transactionCreateSchema` which expects UTC format (`Z`) only
4. Validation fails: "Invalid ISO datetime"

**Impact:** Cannot add transactions from detail panel when parent budget line is checked

### Bug 2: Delete Button Not Working

**Root Cause:** Missing event binding in parent component

| Component | File:Line | Output | Binding |
|-----------|-----------|--------|---------|
| `BudgetItemsContainer` | `budget-items-container.ts:136` | `deleteTransaction = output<string>()` | Declared |
| `BudgetDetailsPage` | `budget-details-page.ts:162-176` | Template bindings | **MISSING `(deleteTransaction)`** |

**Flow:**
1. User clicks delete button in `BudgetDetailPanel` at line 222-229
2. Calls `onDeleteTransaction(tx.id)` which triggers `this.data.onDeleteTransaction(id)`
3. Callback emits through `BudgetGrid.deleteTransaction` output
4. `BudgetItemsContainer` re-emits via `deleteTransaction.emit($event)`
5. **Event is never caught** - no `(deleteTransaction)` binding in `BudgetDetailsPage` template!

**Impact:** Delete button does nothing - event is emitted but never handled

---

## Related Files

| File | Lines | Purpose |
|------|-------|---------|
| `shared/schemas.ts` | 248, 260 | Zod schemas with format mismatch |
| `budget-details-store.ts` | 307-373 | `createAllocatedTransaction()` sends inherited checkedAt |
| `budget-details-page.ts` | 162-176 | Missing `(deleteTransaction)` binding |
| `budget-items-container.ts` | 136 | Has `deleteTransaction` output |
| `budget-detail-panel.ts` | 222-229 | Delete button calls callback |

---

## Step Complete

**Status:** ✓ Complete
**Files found:** 5
**Patterns identified:** 2 root causes
**Next:** step-02-plan.md
**Timestamp:** 2026-01-19T21:15:00.000Z
