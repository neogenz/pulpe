# Step 01: Analyze

**Task:** Create appFinancialKind directive to eliminate repetitive conditional classes
**Started:** 2026-01-20T09:01:00Z

---

## Context Discovery

### Related Files Found

| File | Lines | Contains |
|------|-------|----------|
| `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-grid/budget-detail-panel.ts` | 103-105, 210-211 | 3-line pattern (2x) |
| `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-grid/budget-grid-card.ts` | 87-89 | 3-line pattern (1x) |
| `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-grid/budget-grid-mobile-card.ts` | 110-112 | 3-line pattern (1x) |
| `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-view.ts` | 112-116, 146-154, 222-224, 307-308, 320-324 | 3-line pattern (5x) |
| `frontend/projects/webapp/src/app/ui/breadcrumb/breadcrumb-item.directive.ts` | 1-8 | Existing directive pattern |
| `frontend/projects/webapp/src/app/ui/breadcrumb/breadcrumb-separator.directive.ts` | 1-8 | Existing directive pattern |
| `shared/schemas.ts` | 37-38 | `TransactionKind` type definition |
| `frontend/projects/webapp/src/app/styles/vendors/_tailwind.css` | 156-170 | CSS utility definitions |

### The Exact Repeated Pattern

```typescript
[class.text-financial-income]="<expression>.kind === 'income'"
[class.text-financial-expense]="<expression>.kind === 'expense'"
[class.text-financial-savings]="<expression>.kind === 'saving'"
```

**Repetition count:** 10+ occurrences across 4 files

### Type Definition

```typescript
// shared/schemas.ts:37-38
export const transactionKindSchema = z.enum(['income', 'expense', 'saving']);
export type TransactionKind = z.infer<typeof transactionKindSchema>;
```

### CSS Classes Used

```css
/* frontend/projects/webapp/src/app/styles/vendors/_tailwind.css:156-170 */
@utility text-financial-income { color: var(--pulpe-financial-income); }
@utility text-financial-expense { color: var(--pulpe-financial-expense); }
@utility text-financial-savings { color: var(--pulpe-financial-savings); }
@utility text-financial-negative { color: var(--pulpe-financial-negative); }
```

### Existing Directive Pattern

```typescript
// Minimal structural directives - only expose templateRef
@Directive({ selector: '[pulpeBreadcrumbItem]' })
export class BreadcrumbItemDirective {
  public templateRef = inject(TemplateRef);
}
```

### Patterns Observed

- **Selector prefix:** `pulpe` (from breadcrumb directives)
- **Injection:** Uses `inject()` function
- **Host binding pattern:** Should use `host` object in `@Directive` decorator (per Angular best practices)
- **No attribute directives exist** - this will be the first one

---

## Inferred Acceptance Criteria

Based on the task and existing patterns:

- [ ] AC1: Create `pulpeFinancialKind` directive that applies the correct text color class based on `TransactionKind`
- [ ] AC2: Directive accepts a `TransactionKind` input and dynamically sets `text-financial-{income|expense|savings}` class
- [ ] AC3: Replace all 10+ occurrences of the 3-line pattern in budget-detail-panel, budget-grid-card, budget-grid-mobile-card, budget-table-view
- [ ] AC4: Directive follows Angular best practices: OnPush-compatible, uses `host` for host bindings
- [ ] AC5: All existing functionality preserved (same visual behavior)
- [ ] AC6: Quality checks pass (`pnpm quality`)

---

## Step Complete

**Status:** ✓ Complete
**Files found:** 8
**Patterns identified:** 3 (repetitive class binding, directive structure, CSS utilities)
**Next:** step-02-plan.md
**Timestamp:** 2026-01-20T09:02:00Z
