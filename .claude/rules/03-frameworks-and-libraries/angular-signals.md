---
description: Angular Signal API patterns and best practices
paths:
  - "frontend/**/*.ts"
---

# Angular Signal API Guidelines (v22+)

The signal primitives behave as documented — `signal`, `computed`, `input`, `output`,
`model`, `viewChild`, `toSignal`, `takeUntilDestroyed`. What follows is what the docs do not
tell you about this codebase.

## NG1053 — the one exception to `#private`

**NEVER use ES private (`#field`) for `viewChild`/`viewChildren`/`contentChild`/`contentChildren`/`input`/`output`/`model`.** The Angular compiler forbids ES private on these. Allowed modifiers: `public`, `public readonly`, `protected`, `private`.

```typescript
// ❌ Build fails — NG1053
readonly #inputRef = viewChild<ElementRef>('inputRef');

// ✅ TS private when the field is internal
private readonly inputRef = viewChild<ElementRef>('inputRef');

// ✅ protected when accessed from the template
protected readonly inputRef = viewChild<ElementRef>('inputRef');
```

The cascade is brutal: a single ES-private `viewChild` breaks the component's standalone
compilation, and every consumer importing it then fails with `NG2012: Component imports must
be standalone`. Note this covers `input`/`output`/`model` too, which are not queries.

## linkedSignal with the previous value

The bare form resets on every source change. To carry a selection across, use the object
form — easy to miss, and the reason a filter "randomly" resets:

```typescript
readonly selected = linkedSignal({
  source: this.options,
  computation: (newOpts, prev) => newOpts.find(o => o === prev?.value) ?? newOpts[0],
});
```

## Choosing the Right Resource API

`httpResource()` is **not used in this project**: every call to the Pulpe API goes through
`ApiClient` (`core/api/api-client.ts`), which owns the base URL, Zod parsing, transient-GET
retries and error normalization — `httpResource()` bypasses all four.

| Use Case | API | Reason |
|----------|-----|--------|
| Pulpe API data held by a store | `cachedResource()` over `api.<verb>$()` | `ApiClient` owns Zod, retries, error normalization; cache is shared |
| Pulpe API data local to one component | `rxResource()` / `resource()` over `api.<verb>$()` | Nothing else reads it, so caching it buys nothing |
| Non-HTTP async (localStorage, IndexedDB) | `resource()` | Generic async loader |
| WebSocket/SSE streams, existing Observables | `rxResource()` | Observable-based |

**Decision Flow:**

```
Will more than this one component read the data?
  ├─ Yes → cachedResource() in a store  (see angular-store-pattern.md)
  └─ No → Is it Observable-based?
            ├─ Yes → rxResource()   (tag-history-dialog.ts)
            └─ No → resource()      (search-transactions-dialog.ts)
```

**Project Convention:** API calls never bypass `ApiClient` — no Zod schema, no call. That
holds whichever resource wraps them. What varies is only the wrapper: shared data lives in a
store behind `cachedResource()`, data a single dialog reads and drops does not.

## effect() is a last resort

Valid: logging and analytics, syncing to storage, custom DOM behaviour, third-party library
integration. Never for propagating state between signals or deriving values — that is
`computed()` when read-only, `linkedSignal()` when writable.

## Signal Forms (Experimental — Angular 21.1+)

**Migration 21.1:** `Field` directive renamed → `FormField`. Selector `[field]` →
`[formField]`. Type `Field<T>` still exported as a **type only** (signature for field
signals). `customError({ kind })` removed → return plain `{ kind }` from `validate()`.

```typescript
import { form, FormField } from '@angular/forms/signals';

readonly model = signal({ email: '', password: '' });
readonly loginForm = form(this.model);
// template: <input [formField]="loginForm.email" />
// state:    loginForm.email().value() / .valid() / .touched()
```

## Inline templates

Write the template **inline** unless the component is large enough that the file becomes hard
to read. The webapp is near-unanimous: 171 components use inline `template:` against 4
`templateUrl`, and only 3 component `.html` files exist in the whole app.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `effect(() => this.b.set(this.a()))` | `b = computed(() => this.a())` or `b = linkedSignal(() => this.a())` |
| `signal.mutate(arr => arr.push(x))` | `signal.update(arr => [...arr, x])` |
| Read signal in constructor before init | `afterNextRender()` or `effect()` |
| `toSignal()` without `initialValue` when sync needed | Provide `initialValue` or handle `undefined` |
| Subscribe in a component without cleanup | `takeUntilDestroyed()` or `toSignal()` |
