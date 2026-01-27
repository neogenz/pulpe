---
description: "UI layer - Pure UI components (no business logic, no services)"
paths: "frontend/**/ui/**/*"
---

# UI Layer

**Scope**: Pure, self-contained UI components (NO business logic, NO services)

## ⚠️ CRITICAL Rules

- **NEVER inject services** (no `inject()` calls)
- **Inputs/outputs ONLY** - All data comes from parent via inputs
- **Self-contained** - No external dependencies whatsoever
- **Pure presentation** - No business logic, no domain knowledge
- **Optimized by bundler** - Eager/lazy determined automatically by usage

## Dependency Rules

```
ui/ ──✅──> ui/        (Internal composition allowed between UI components)
ui/ ──❌──> core/      (FORBIDDEN - no service injection)
ui/ ──❌──> pattern/   (FORBIDDEN - no cross-dependencies)
ui/ ──❌──> feature/   (FORBIDDEN - no feature coupling)
ui/ ──❌──> layout/    (FORBIDDEN - self-contained)
ui/ ──❌──> styles/    (Self-styled, inline or component styles)
```

**UI depends on NOTHING external** - Completely isolated and reusable. Internal composition between UI components is allowed.

## What Belongs in UI

✅ **Generic components**:
- Buttons, badges, chips, avatars
- Cards, panels, dialogs
- Form controls (inputs, selects, checkboxes)
- Loading spinners, skeletons
- Icons, dividers

✅ **Characteristics**:
- Generic and reusable across ANY feature
- No domain-specific knowledge (no "Driver", "Absence", etc.)
- Data-agnostic (works with any data shape via inputs)
- Stateless (parent manages state via signals)

## What Does NOT Belong in UI

❌ **Components with services**:
- If it needs `inject(SomeService)` → Move to `pattern/` or `feature/`
- If it needs HTTP calls → Move to `pattern/` or `feature/`
- If it needs global state → Move to `pattern/` or `feature/`

❌ **Domain-specific components**:
- `UserCard` → Move to `pattern/` (domain concept)
- `OrderTimeline` → Move to `pattern/` (business logic)
- `InvoiceForm` → Move to `pattern/` (business workflow)

❌ **Complex business logic**:
- If component has business rules → Move to `pattern/` or `feature/`

## UI vs Pattern

| Aspect | UI Layer | Pattern Layer |
|--------|----------|---------------|
| **Services** | ❌ NEVER | ✅ Can inject from `core/` |
| **Dependencies** | ❌ NONE | ✅ Can import `core/`, `ui/` |
| **Domain knowledge** | ❌ Generic only | ✅ Business concepts |
| **State** | ❌ Stateless (inputs) | ✅ Can have local state |
| **Reusability** | ✅ ANY app | ✅ Within this app |

**Example Decision**:
```typescript
// ❌ WRONG - UI component with service injection
@Component({ /* ... */ })
export class UserCard {
  readonly userService = inject(UserService); // FORBIDDEN in UI
}

// ✅ CORRECT - UI component with inputs only
@Component({ /* ... */ })
export class Card {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly clicked = output<void>();
}

// ✅ CORRECT - Pattern component with service
@Component({ /* ... */ })
export class UserCard {
  readonly userId = input.required<string>();
  readonly #userService = inject(UserService); // OK in pattern
}
```

## Implementation Pattern

```typescript
// Good - Pure UI component
@Component({
  selector: 'app-button',
  template: `
    <button
      [class]="variant()"
      [disabled]="disabled()"
      (click)="clicked.emit()"
    >
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-block; }
    button { /* inline styles */ }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonComponent {
  readonly variant = input<'primary' | 'secondary'>('primary');
  readonly disabled = input(false);
  readonly clicked = output<void>();
}
```

**Usage**:
```typescript
// Parent manages state, UI just presents
@Component({
  template: `
    <app-button
      [variant]="'primary'"
      [disabled]="isLoading()"
      (clicked)="handleSave()"
    >
      Save
    </app-button>
  `
})
export class MyFeature {
  readonly isLoading = signal(false);

  handleSave() {
    // Business logic here
  }
}
```

## Key Takeaway

UI components are **pure presentation layers** - they receive data through inputs, emit events through outputs, and contain no business logic or external dependencies. They are maximally reusable across any project.
