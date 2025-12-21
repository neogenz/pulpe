---
description: Advanced Angular signal patterns and state management
globs:
  - "frontend/**/core/**/*.ts"
  - "frontend/**/feature/**/*.ts"
  - "!frontend/**/*.spec.ts"
---

# Angular Signal API Guidelines (v21+)

## Core Primitives

### signal() - Writable State
```typescript
private readonly _count = signal(0);
readonly count = this._count.asReadonly();

this._count.set(5);           // replace
this._count.update(v => v + 1); // transform
```

### computed() - Derived State
```typescript
readonly doubled = computed(() => this.count() * 2);
```
- Lazy, memoized, read-only

### linkedSignal() - Dependent Writable State
```typescript
readonly selected = linkedSignal(() => this.options()[0]);
```

## Component Communication

```typescript
readonly name = input.required<string>();  // required input
readonly clicked = output<void>();          // output
readonly value = model(0);                  // two-way binding
```

## Async Data

### resource() / httpResource()
```typescript
readonly user = resource({
  params: () => ({ id: this.userId() }),
  loader: ({ params }) => fetch(`/api/users/${params.id}`)
});

this.user.value();      // data
this.user.isLoading();  // boolean
this.user.reload();     // refresh
```

## Side Effects

### effect() - Last Resort
```typescript
effect(() => console.log(`User: ${this.user()}`));
```

**Valid uses:** Logging, localStorage sync, DOM manipulation
**NEVER use for:** State propagation, deriving values

## RxJS Interop
```typescript
readonly user = toSignal(this.user$, { initialValue: null });
readonly user$ = toObservable(this.userSignal);
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `effect(() => this.b.set(this.a()))` | `computed()` or `linkedSignal()` |
| `signal.mutate(arr => arr.push(x))` | `signal.update(arr => [...arr, x])` |
| Subscribe without cleanup | `takeUntilDestroyed()` or `toSignal()` |
