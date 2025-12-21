---
description: Angular component patterns and Material Design 3
globs:
  - "frontend/**/*.ts"
  - "!frontend/**/*.spec.ts"
---

# Angular Best Practices

## TypeScript

- **Strict Type Checking:** Always enable strict mode
- **Prefer Type Inference:** Let TypeScript infer obvious types
- **Avoid `any`:** Use `unknown` when type is uncertain

## Angular Core

- **Standalone Components:** Always use standalone (implicit, no need for `standalone: true`)
- **Signals for State:** Use Angular Signals for reactive state
- **Lazy Loading:** Implement lazy loading for feature routes
- **Host bindings:** Use `host` object in decorator, NOT `@HostBinding`/`@HostListener`

## Components

- **Single Responsibility:** One purpose per component
- **`input()` and `output()`:** Prefer functions over decorators
- **`computed()`:** For derived state from signals
- **`OnPush`:** ALWAYS set `changeDetection: ChangeDetectionStrategy.OnPush`
- **Inline Templates:** Prefer inline for small components

## Templates

- **Native Control Flow:** Use `@if`, `@for`, `@switch` (NOT `*ngIf`, `*ngFor`)
- **No `ngClass`/`ngStyle`:** Use native `[class.x]` and `[style.x]` bindings
- **Async Pipe:** Use for observables in templates

## Services

- **`providedIn: 'root'`:** For singleton services
- **`inject()`:** Prefer over constructor injection

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `standalone: true` | Implicit (omit it) |
| `@Input()` decorator | `input()` function |
| `*ngIf` / `*ngFor` | `@if` / `@for` |
| `[ngClass]` | `[class.active]` |
| Constructor injection | `inject()` function |
