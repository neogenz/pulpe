---
description: "UI layer - Pure UI components (no business logic, no services)"
paths: "frontend/**/ui/**/*"
---

# UI Layer

**Scope**: Pure, self-contained UI components (NO business logic, NO services)

## ⚠️ CRITICAL Rules

- **NEVER inject app/business services** from `core/` (no `inject(UserService)`, `inject(AuthStore)`, etc.)
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
```

Enforced by `eslint-plugin-boundaries` in `frontend/eslint.config.js` (`default: "disallow"`,
18 element types) — an illegal import fails lint. Read that config, not this block, when the
two disagree.

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
- Needs `inject(UserService)`, `inject(AuthStore)`, etc. → Move to `pattern/` or `feature/`
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

The line is which injector the component reaches into. `inject(MatDialogRef)` or
`inject(MAT_DIALOG_DATA)` is a framework token and stays in `ui/`; `inject(UserService)` is
an app service and moves the component to `pattern/`. A `ui/` component that takes only
`input()`s and emits `output()`s never has to make that call.

## Key Takeaway

UI components = **pure presentation layers**. Receive data via inputs, emit events via outputs, no business logic or external deps. Max reusable across any project.