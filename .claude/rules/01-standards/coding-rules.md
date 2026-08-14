---
description: "TypeScript class member conventions and patterns"
paths:
  - "**/*.ts"
---

# Coding Rules

## Class Members

### Private Members

Use JavaScript private class fields (`#`) for all private members:

```typescript
// Good
readonly #count = signal(0);
readonly #http = inject(HttpClient);

// Bad
private readonly _count = signal(0);
private readonly http = inject(HttpClient);
```

> ⚠️ **Exception NG1053** — the Angular compiler rejects `#` on `viewChild` / `viewChildren` / `contentChild` / `contentChildren` / `input` / `output` / `model`. Use TS `private` (or `protected` when the template reads it) on those members. See `.claude/rules/03-frameworks-and-libraries/angular-signals.md`.

### Readonly Properties

Mark properties as `readonly` when they should not be reassigned after initialization:

```typescript
// Good
readonly #items = signal<Item[]>([]);
readonly doubled = computed(() => this.#count() * 2);

// Bad
#items = signal<Item[]>([]);
doubled = computed(() => this.#count() * 2);
```

### Component View Bindings

Use `protected` for component members accessed in templates instead of `public`:

```typescript
@Component({
  template: `<button (click)="onClick()">{{ label() }}</button>`
})
export class ButtonComponent {
  // Good - protected for template access
  protected readonly label = input.required<string>();
  protected onClick() { /* ... */ }

  // Bad - public for template access
  public readonly label = input.required<string>();
  public onClick() { /* ... */ }
}
```

### Summary

| Context | Modifier |
|---------|----------|
| Private members | `#member` — except `viewChild`/`viewChildren`/`contentChild`/`contentChildren`/`input`/`output`/`model`, see NG1053 above |
| Template bindings | `protected` |
| Public API (inputs/outputs for parent components) | `readonly` (implicit public) |
| Immutable after init | `readonly` |

### Import Paths

Use path aliases between architectural layers and relative imports inside one feature or
component folder. Barrels are pure re-exports; never import a folder's own barrel from a file
inside that folder, because that creates a circular dependency.
