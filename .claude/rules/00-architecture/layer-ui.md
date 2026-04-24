---
description: "UI layer - Pure UI components (no business logic, no services)"
paths: "frontend/**/ui/**/*"
---

# UI Layer

**Scope**: Pure, self-contained UI components (NO business logic, NO services)

## ⚠️ CRITICAL Rules

- **NEVER inject app/business services** from `core/` (no `inject(UserService)`, `inject(AuthStateService)`, etc.)
- **Angular/Material framework services ARE allowed**: `inject(MatDialogRef)`, `inject(ElementRef)`, `inject(DestroyRef)`, `inject(Renderer2)`, etc.
- **Inputs/outputs ONLY** for data flow — business data from parent via inputs
- **Self-contained** - No deps on app-specific code
- **Pure presentation** - No business logic, no domain knowledge
- **Optimized by bundler** - Eager/lazy auto by usage

## Dependency Rules

```
ui/ ──✅──> ui/        (Internal composition allowed between UI components)
ui/ ──❌──> core/      (FORBIDDEN - no service injection)
ui/ ──❌──> pattern/   (FORBIDDEN - no cross-dependencies)
ui/ ──❌──> feature/   (FORBIDDEN - no feature coupling)
ui/ ──❌──> layout/    (FORBIDDEN - self-contained)
ui/ ──❌──> styles/    (Self-styled, inline or component styles)
```

**UI deps on NOTHING external** - Fully isolated, reusable. Internal composition between UI components OK.

## What Belongs in UI

✅ **Generic components**:
- Buttons, badges, chips, avatars
- Cards, panels, dialogs
- Form controls (inputs, selects, checkboxes)
- Loading spinners, skeletons
- Icons, dividers

✅ **Characteristics**:
- Generic, reusable across ANY feature
- No domain knowledge (no "Driver", "Absence", etc.)
- Data-agnostic (any shape via inputs)
- Stateless (parent owns state via signals)

## What Does NOT Belong in UI

❌ **Components with app/business services**:
- Needs `inject(UserService)`, `inject(AuthStateService)`, etc. → Move to `pattern/` or `feature/`
- Needs HTTP → Move to `pattern/` or `feature/`
- Needs global state → Move to `pattern/` or `feature/`
- Note: Angular/Material framework services (`MatDialogRef`, `ElementRef`, `DestroyRef`, etc.) fine

❌ **Domain-specific components**:
- `UserCard` → Move to `pattern/` (domain concept)
- `OrderTimeline` → Move to `pattern/` (business logic)
- `InvoiceForm` → Move to `pattern/` (business workflow)

❌ **Complex business logic**:
- Component has business rules → Move to `pattern/` or `feature/`

## UI vs Pattern

| Aspect | UI Layer | Pattern Layer |
|--------|----------|---------------|
| **Services** | ✅ Angular/Material framework only | ✅ Can inject from `core/` |
| **Dependencies** | ✅ Angular/Material only | ✅ Can import `core/`, `ui/` |
| **Domain knowledge** | ❌ Generic only | ✅ Business concepts |
| **State** | ❌ Stateless (inputs) | ✅ Can have local state |
| **Reusability** | ✅ ANY app | ✅ Within this app |

**Example Decision**:
```typescript
// ❌ WRONG - UI component with app/business service
@Component({ /* ... */ })
export class UserCard {
  readonly #userService = inject(UserService); // FORBIDDEN - app service
}

// ✅ CORRECT - UI component with Angular/Material framework service
@Component({ /* ... */ })
export class ConfirmationDialog {
  readonly #dialogRef = inject(MatDialogRef); // OK - framework service
  readonly #data = inject(MAT_DIALOG_DATA);   // OK - framework token
}

// ✅ CORRECT - UI component with inputs only
@Component({ /* ... */ })
export class Card {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly clicked = output<void>();
}

// ✅ CORRECT - Pattern component with app service
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

UI components = **pure presentation layers**. Receive data via inputs, emit events via outputs, no business logic or external deps. Max reusable across any project.