# Angular Official Style Guide (Condensed)

> Condensed from angular.dev/style-guide and angular.dev/best-practices.
> These are official Angular conventions — not project-specific opinions.

---

## 1. Member Visibility

### `protected` for template-only members

Public members form a component's API (accessible via DI and queries). Use `protected` for anything only accessed from the template — it prevents external code from depending on internal template bindings.

```typescript
@Component({
  template: `<p>{{ fullName() }}</p>`,
})
export class UserProfileComponent {
  readonly firstName = input<string>();
  readonly lastName = input<string>();

  // Not part of public API, but needed by template
  protected readonly fullName = computed(() =>
    `${this.firstName()} ${this.lastName()}`
  );

  // Public API — other components can call this via queries
  resetForm(): void { /* ... */ }
}
```

**Rule:** If a method or computed signal is ONLY read from the template, mark it `protected`. If it's part of the component's public contract (called by parents, used in tests via component reference), keep it `public`.

### `readonly` on Angular-initialized properties

Mark properties initialized by Angular as `readonly` — prevents accidental reassignment.

```typescript
readonly userId = input<string>();
readonly userSaved = output<void>();
readonly userName = model<string>();
readonly nameInput = viewChild<ElementRef>('nameInput');
```

This applies to: `input()`, `input.required()`, `output()`, `model()`, `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`.

---

## 2. Event Handler Naming

Name handlers for **what they do**, not the triggering event:

```html
<!-- Good — describes the action -->
<button (click)="saveUserData()">Save</button>
<button (click)="deleteBudget()">Supprimer</button>

<!-- Bad — describes the event -->
<button (click)="handleClick()">Save</button>
<button (click)="onClick()">Supprimer</button>
```

For keyboard events, use Angular's key modifiers with specific names:

```html
<textarea
  (keydown.control.enter)="commitNotes()"
  (keydown.control.space)="showSuggestions()"
>
```

Exception: when event handling is complex and delegates to multiple behaviors, a generic `handleKeydown(event)` is acceptable.

---

## 3. Component Member Order

Group Angular-specific properties together at the top, before methods. This makes template APIs and dependencies scannable.

```typescript
export class BudgetCardComponent {
  // 1. Injected dependencies
  readonly #store = inject(BudgetStore);
  readonly #router = inject(Router);

  // 2. Inputs
  readonly budget = input.required<Budget>();
  readonly isActive = input(false);

  // 3. Outputs
  readonly selected = output<Budget>();

  // 4. Queries
  readonly nameInput = viewChild<ElementRef>('nameInput');

  // 5. Computed / derived state
  protected readonly displayName = computed(() => this.budget().name);

  // 6. Methods (after all properties)
  selectBudget(): void { /* ... */ }
}
```

---

## 4. Lifecycle Hooks

### Implement interfaces

Always import and `implements` the lifecycle interface — it guarantees correct method naming.

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({ /* ... */ })
export class BudgetComponent implements OnInit, OnDestroy {
  ngOnInit(): void { /* ... */ }
  ngOnDestroy(): void { /* ... */ }
}
```

### Keep hooks simple

Don't put long logic in lifecycle hooks. Delegate to well-named methods — hook names describe WHEN (timing), methods describe WHAT (action).

```typescript
// Good — clear what each step does
ngOnInit(): void {
  this.initializeTracking();
  this.loadInitialData();
}

// Bad — all logic inlined
ngOnInit(): void {
  this.analytics.setMode('info');
  this.analytics.monitorErrors();
  // 30 more lines...
}
```

### Empty hooks are dead code

If `ngOnInit` or `ngOnDestroy` has no body, remove it entirely. Empty lifecycle hooks are noise.

---

## 5. Components & Presentation

### Focused on presentation

Components should focus on UI coordination. Business logic, data transformations, and validation rules belong in stores, services, or standalone functions — not in the component class.

### Avoid complex template logic

When a template expression gets complex, move it to a `computed()` signal. There's no hard rule for "complex", but as a guideline: if it has a method call, a ternary, or accesses nested properties 3+ levels deep, it probably belongs in a `computed()`.

### `class`/`style` over `ngClass`/`ngStyle`

Built-in bindings are simpler and more performant:

```html
<!-- Good -->
<div [class.admin]="isAdmin()" [class.dense]="isDense()">
<div [style.color]="textColor()">

<!-- Bad -->
<div [ngClass]="{'admin': isAdmin(), 'dense': isDense()}">
<div [ngStyle]="{'color': textColor()}">
```

---

## 6. File & Project Organization

### One concept per file

Each file should focus on a single concept. One component, one service, one store per file. If a file contains multiple classes, consider splitting.

### Feature-based directories

Organize by feature, not by type. Don't create `components/`, `services/`, `directives/` folders.

```
# Good — organized by feature
feature/budget/
├── budget.ts
├── budget.store.ts
├── budget-card.ts

# Bad — organized by type
components/
├── budget.ts
├── budget-card.ts
services/
├── budget.store.ts
```

### File naming

- Hyphen-separated words: `budget-card.ts`, not `budgetCard.ts`
- File name matches the class: `BudgetCardComponent` → `budget-card.ts`
- Tests alongside source: `budget-card.spec.ts` next to `budget-card.ts`
- Same base name for component files: `budget-card.ts`, `budget-card.html`, `budget-card.scss`

---

## 7. Dependency Injection

### Prefer `inject()` over constructor

`inject()` is more readable, especially with many dependencies. Better type inference, easier to comment.

```typescript
// Good
readonly #store = inject(BudgetStore);
readonly #router = inject(Router);

// Bad
constructor(
  private store: BudgetStore,
  private router: Router,
) {}
```

---

## Anti-Pattern Summary

| Angular Style Guide Rule | Anti-Pattern | Fix |
|--------------------------|-------------|-----|
| Protected template members | `public` method only used by template | `protected` |
| Readonly signals | Missing `readonly` on `input()`, `output()`, etc. | Add `readonly` |
| Action-based handlers | `handleClick()`, `onClick()` | `saveData()`, `deleteBudget()` |
| Member ordering | Methods mixed with properties | Properties first, methods after |
| Lifecycle interfaces | `ngOnInit()` without `implements OnInit` | Add `implements` |
| Simple lifecycle hooks | 30+ lines in `ngOnInit` | Delegate to named methods |
| Empty lifecycle hooks | Empty `ngOnInit() {}` | Remove entirely |
| Class/style bindings | `[ngClass]`, `[ngStyle]` | `[class.x]`, `[style.y]` |
| One concept per file | Multiple classes in one file | Split into separate files |
| Feature-based organization | `components/`, `services/` folders | Feature folders |

**Source:** angular.dev/style-guide
