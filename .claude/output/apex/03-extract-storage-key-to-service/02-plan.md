# Step 02: Plan

**Task:** Extract VIEW_MODE_STORAGE_KEY into StorageService, use from budget-items-container.ts, store key in storage-key.ts
**Started:** 2026-01-20T07:03:00Z

---

## Implementation Plan: Extract Storage Key to Centralized Service

### Overview
Add `BUDGET_DESKTOP_VIEW` key to centralized `STORAGE_KEYS` constant and refactor `BudgetItemsContainer` to use `StorageService` instead of direct localStorage access.

### Prerequisites
- None (all dependencies already exist)

---

### File Changes

#### 1. `core/storage/storage-keys.ts`
- Add `BUDGET_DESKTOP_VIEW: 'pulpe-budget-desktop-view'` to `STORAGE_KEYS` object
- Follow existing pattern: SCREAMING_SNAKE_CASE key name
- Value matches current `VIEW_MODE_STORAGE_KEY` constant

#### 2. `feature/budget/budget-details/budget-items-container.ts`
- **Import changes (line 1-32):**
  - Add `StorageService, STORAGE_KEYS` import from `@core/storage`

- **Remove local constant (line 34):**
  - Delete `const VIEW_MODE_STORAGE_KEY = 'pulpe-budget-desktop-view';`

- **Inject service (line 126-127):**
  - Add `readonly #storageService = inject(StorageService);` after breakpointObserver injection

- **Update effect (line 197-203):**
  - Replace `localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)` with
    `this.#storageService.setString(STORAGE_KEYS.BUDGET_DESKTOP_VIEW, mode)`

- **Update getter method (line 206-212):**
  - Replace `localStorage.getItem(VIEW_MODE_STORAGE_KEY)` with
    `this.#storageService.getString(STORAGE_KEYS.BUDGET_DESKTOP_VIEW)`

---

### Testing Strategy

**No new tests required:**
- `StorageService` is already fully tested
- Component behavior unchanged (same key, same values)
- Existing E2E tests cover budget view functionality

**Verify:**
- Run lint to ensure no unused imports
- Run tests to verify no regressions

---

### Acceptance Criteria Mapping

- [x] AC1: Add `BUDGET_DESKTOP_VIEW` key → `storage-keys.ts` change
- [x] AC2: Inject `StorageService` → `budget-items-container.ts` line ~127
- [x] AC3: Replace direct `localStorage` calls → effect and getter method
- [x] AC4: Remove local constant → delete line 34

---

### Risks & Considerations
- **Low risk:** Simple refactoring, no behavior change
- **Backward compatible:** Same storage key value, existing persisted data will work

---

## Step Complete

**Status:** ✓ Complete
**Files planned:** 2
**Tests planned:** 0 (verification only)
**Next:** step-03-execute.md
**Timestamp:** 2026-01-20T07:03:30Z
