# Implementation Plan: Fix Skipped Budget Table Tests

## Overview

9 tests in `budget-table.spec.ts` are skipped due to a known Angular/Vitest limitation: **mock components with signal inputs don't receive values when rendered inside `@for` loops**.

## Research Summary

### Documentation Sources Consulted
- **Angular CLI MCP**: No direct solution for signal inputs in @for loops
- **ng-mocks (Context7)**: Known issues #8887, #9698 confirm signal input limitations
- **Angular Testing Library (Context7)**: `inputs` property works for direct component testing
- **Web Search**: Wrapper Component Pattern identified as most reliable solution

### Root Cause
Custom `MockBudgetTableMobileCard` uses `input<BudgetLineTableItem>()` signal. When parent renders via `@for (item of items) { <mock [item]="item" /> }`, the mock's signal input doesn't receive values during Vitest test lifecycle.

## Options

### Option A: Remove Skipped Tests (Recommended)

**Rationale:**
- 100% E2E coverage exists in `budget-table-mobile-menu.spec.ts`
- Skipped tests provide zero value
- E2E tests are more reliable for UI integration testing
- Minimal effort, no risk

**Effort:** ~15 minutes

### Option B: Fix with Wrapper Component Pattern

**Rationale:**
- Maintains unit test coverage alongside E2E
- Wrapper component lets Angular handle binding naturally
- Proven pattern from Angular testing documentation

**Effort:** ~1-2 hours

---

## Option A: Remove Tests (Recommended)

### File Changes

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.spec.ts`

- **Action 1**: Remove `MockBudgetTableMobileCard` mock component (lines 59-112)
  - Only used by skipped tests
  - Keep `MockBudgetTableViewToggle` (used by active tests)

- **Action 2**: Remove TODO comment and `describe.skip('Mobile View')` block (lines 298-470)
  - 7 tests, all covered by E2E

- **Action 3**: Remove `describe.skip('Responsive Behavior')` block (lines 472-531)
  - 2 tests, covered by E2E

- **Action 4**: Remove `MockBudgetTableMobileCard` from TestBed imports override (line 203)

### Verification
```bash
pnpm test budget-table.spec.ts
# Expect: 0 skipped tests, all passing
```

---

## Option B: Fix with Wrapper Component Pattern

### Approach
Create a `TestHostComponent` that wraps `BudgetTable` and provides data through natural Angular binding. This bypasses the signal input timing issue.

### File Changes

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.spec.ts`

- **Action 1**: Remove `MockBudgetTableMobileCard` (lines 59-112)
  - Will use real `BudgetTableMobileCard` component instead

- **Action 2**: Create `TestHostComponent` for mobile view tests
  ```typescript
  @Component({
    template: `
      <pulpe-budget-table
        [budgetLines]="budgetLines"
        [transactions]="transactions"
        (delete)="onDelete($event)"
        (update)="onUpdate($event)"
        (resetFromTemplate)="onReset($event)"
      />
    `,
    imports: [BudgetTable],
  })
  class TestHostComponent {
    budgetLines = signal<BudgetLineViewModel[]>([]);
    transactions = signal<TransactionViewModel[]>([]);
    onDelete = vi.fn();
    onUpdate = vi.fn();
    onReset = vi.fn();
  }
  ```

- **Action 3**: Update `describe('Mobile View')` tests
  - Remove `.skip` modifier
  - Use `TestHostComponent` fixture instead of direct `BudgetTable` fixture
  - Set inputs via `testHost.budgetLines.set([...])`
  - Query DOM normally - real components will render

- **Action 4**: Update `describe('Responsive Behavior')` tests
  - Remove `.skip` modifier
  - Use same `TestHostComponent` approach

- **Action 5**: Update TestBed configuration for mobile tests
  - Import real `BudgetTableMobileCard` instead of mock
  - Keep `MockBudgetTableViewToggle` for view toggle isolation

### Key Changes in Test Structure
```typescript
describe('Mobile View', () => {
  let testHost: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    // Configure with real BudgetTableMobileCard
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, NoopAnimationsModule],
      providers: [/* same providers */],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    testHost = fixture.componentInstance;
    testHost.budgetLines.set(mockBudgetLines);
    fixture.detectChanges();
  });

  it('should show envelope cards with menu button', () => {
    breakpointSubject.next({ matches: true, breakpoints: {} });
    fixture.detectChanges();

    const menuButton = fixture.nativeElement.querySelector(
      '[data-testid="card-menu-budget-line-1"]'
    );
    expect(menuButton).toBeTruthy();
  });
});
```

### Verification
```bash
pnpm test budget-table.spec.ts
# Expect: All 9 previously skipped tests now passing
```

---

## E2E Coverage Reference

The functionality tested by skipped unit tests is covered by:

| Unit Test | E2E Test Location |
|-----------|-------------------|
| Mobile menu button | `budget-table-mobile-menu.spec.ts:51-55` |
| Menu items edit/delete | `budget-table-mobile-menu.spec.ts:57-64` |
| French menu text | `budget-table-mobile-menu.spec.ts:81-92` |
| Edit action → dialog | `budget-table-mobile-menu.spec.ts:94-109` |
| Delete action | `budget-table-mobile-menu.spec.ts:111-129` |
| Responsive switching | `budget-table-mobile-menu.spec.ts:193-210` |

---

## Recommendation

**Choose Option A (Remove)** if:
- E2E coverage is sufficient
- You want minimal maintenance burden
- Quick resolution is preferred

**Choose Option B (Fix)** if:
- Unit test coverage is a project requirement
- You want faster feedback loop than E2E
- The tests serve as documentation for the mobile component API

---

## Dependencies

None - no production code changes required for either option.

## Documentation

No documentation updates needed - internal test changes only.
