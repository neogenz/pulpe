---
description: "TypeScript class member conventions and patterns"
paths: "**/*.ts"
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
| Private members | `#member` |
| Template bindings | `protected` |
| Public API (inputs/outputs for parent components) | `readonly` (implicit public) |
| Immutable after init | `readonly` |

### Import Paths

Use TypeScript path aliases for imports between architectural elements (not within the same directory or feature):

```typescript
// Good - using tspath alias
import { UserService } from '@core/services';

// Bad - relative paths crossing architectural boundaries
import { UserService } from '../../../core/services';
```