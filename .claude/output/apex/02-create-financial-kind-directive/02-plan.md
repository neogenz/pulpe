# Step 02: Plan

**Task:** Create appFinancialKind directive to eliminate repetitive conditional classes
**Started:** 2026-01-20T09:03:00Z

---

## Implementation Plan: Financial Kind Directive

### Overview

Create a reusable attribute directive `pulpeFinancialKind` that accepts a `TransactionKind` value and applies the appropriate `text-financial-{income|expense|savings}` CSS class. This replaces 6 occurrences of the repetitive 3-line class binding pattern across 4 components.

### Prerequisites

- [ ] None - this is a new standalone directive

---

### File Changes

#### 1. `frontend/projects/webapp/src/app/ui/financial-kind/financial-kind.directive.ts` (NEW FILE)

Create the attribute directive:
- Selector: `[pulpeFinancialKind]`
- Input: `kind` of type `TransactionKind` (aliased to `pulpeFinancialKind`)
- Uses `host` object for class bindings (Angular best practice)
- Maps `'income'` → `text-financial-income`, `'expense'` → `text-financial-expense`, `'saving'` → `text-financial-savings`
- Pattern: Follow project conventions (inject, signals, OnPush-compatible)

#### 2. `frontend/projects/webapp/src/app/ui/financial-kind/index.ts` (NEW FILE)

Export barrel file for the directive.

#### 3. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-grid/budget-detail-panel.ts`

**Lines 103-105:** Replace the 3-line pattern:
```typescript
// Before
[class.text-financial-income]="envelope.data.kind === 'income'"
[class.text-financial-expense]="envelope.data.kind === 'expense'"
[class.text-financial-savings]="envelope.data.kind === 'saving'"

// After
[pulpeFinancialKind]="envelope.data.kind"
```

- Add import for `FinancialKindDirective`
- Add to component imports array

#### 4. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-grid/budget-grid-card.ts`

**Lines 87-89:** Replace the 3-line pattern:
```typescript
// Before
[class.text-financial-income]="item().data.kind === 'income'"
[class.text-financial-expense]="item().data.kind === 'expense'"
[class.text-financial-savings]="item().data.kind === 'saving'"

// After
[pulpeFinancialKind]="item().data.kind"
```

- Add import for `FinancialKindDirective`
- Add to component imports array

#### 5. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-grid/budget-grid-mobile-card.ts`

**Lines 110-112:** Replace the 3-line pattern:
```typescript
// Before
[class.text-financial-income]="item().data.kind === 'income'"
[class.text-financial-expense]="item().data.kind === 'expense'"
[class.text-financial-savings]="item().data.kind === 'saving'"

// After
[pulpeFinancialKind]="item().data.kind"
```

- Add import for `FinancialKindDirective`
- Add to component imports array

#### 6. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-view.ts`

Three replacements:

**Lines 112-116 (icon):**
```typescript
// Before
[class.text-financial-income]="line.data.kind === 'income'"
[class.text-financial-expense]="line.data.kind === 'expense'"
[class.text-financial-savings]="line.data.kind === 'saving'"

// After
[pulpeFinancialKind]="line.data.kind"
```

**Lines 146-154 (name text):**
```typescript
// Before
[class.text-financial-income]="line.data.kind === 'income'"
[class.text-financial-expense]="line.data.kind === 'expense'"
[class.text-financial-savings]="line.data.kind === 'saving'"

// After
[pulpeFinancialKind]="line.data.kind"
```

**Lines 222-224 (planned amount):**
```typescript
// Before
[class.text-financial-income]="line.data.kind === 'income'"
[class.text-financial-expense]="line.data.kind === 'expense'"
[class.text-financial-savings]="line.data.kind === 'saving'"

// After
[pulpeFinancialKind]="line.data.kind"
```

- Add import for `FinancialKindDirective`
- Add to component imports array

---

### NOT Changing (Different Logic)

The following patterns have **different logic** and will NOT use the directive:

| File | Lines | Reason |
|------|-------|--------|
| budget-detail-panel.ts | 210-211 | Uses `income` vs `error` (not expense/savings) |
| budget-table-view.ts | 307-310 | Uses `income` vs `negative` for expense OR saving |
| budget-table-view.ts | 320-325 | Based on `cumulativeBalance >= 0`, not kind |

---

### Testing Strategy

**No new test files required** - the directive is purely presentation logic that:
1. Maps a value to a CSS class
2. Is automatically tested via existing component tests (visual appearance)
3. Will be validated by running `pnpm quality` (type checking)

---

### Acceptance Criteria Mapping

- [x] AC1: Create `pulpeFinancialKind` directive → `financial-kind.directive.ts`
- [x] AC2: Directive accepts `TransactionKind` and applies correct class → Directive implementation
- [x] AC3: Replace all occurrences of 3-line pattern → 4 component files updated (6 replacements total)
- [x] AC4: Directive follows Angular best practices → Uses `host` object, no decorators for host bindings
- [x] AC5: Same visual behavior → Directive maps to identical CSS classes
- [x] AC6: Quality checks pass → Run `pnpm quality` at end

---

### Risks & Considerations

- **Low risk:** Simple 1:1 mapping from repeated code to directive
- **Consideration:** The directive uses the CSS utilities defined in `_tailwind.css` - these remain unchanged

---

## Summary

| Metric | Count |
|--------|-------|
| Files to modify | 4 |
| New files | 2 |
| Pattern replacements | 6 |
| Lines removed (approx) | 18 lines of repetitive code |
| Lines added (approx) | 6 lines (directive usage) |

---

## Step Complete

**Status:** ✓ Complete
**Files planned:** 6
**Tests planned:** 0 (covered by existing tests)
**Next:** step-03-execute.md
**Timestamp:** 2026-01-20T09:04:00Z
