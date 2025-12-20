# Angular Signal API Guidelines (v21+)

## Core Primitives

### signal() - Writable State

```typescript
private readonly _count = signal(0);
readonly count = this._count.asReadonly(); // expose read-only

// Update
this._count.set(5);           // replace value
this._count.update(v => v + 1); // transform value
```

### computed() - Derived State

```typescript
readonly doubled = computed(() => this.count() * 2);
readonly label = computed(() => `Count: ${this.count()}`);
```

- Lazy evaluation, memoized
- Auto-tracks dependencies
- Read-only (cannot `set()`)

### linkedSignal() - Dependent Writable State

```typescript
readonly options = signal(['A', 'B', 'C']);
readonly selected = linkedSignal(() => this.options()[0]);

// Can be manually set
this.selected.set('B');

// Resets when options change
this.options.set(['X', 'Y']); // selected becomes 'X'
```

**With previous value:**

```typescript
readonly selected = linkedSignal({
  source: this.options,
  computation: (newOpts, prev) =>
    newOpts.find(o => o === prev?.value) ?? newOpts[0]
});
```

---

## Component Communication

### input() - Signal Inputs

```typescript
readonly name = input<string>();           // optional, undefined initially
readonly name = input('default');          // optional with default
readonly name = input.required<string>();  // required
```

### output() - Signal Outputs

```typescript
readonly clicked = output<void>();
readonly selected = output<Item>();

onClick() {
  this.clicked.emit();
  this.selected.emit(item);
}
```

### model() - Two-Way Binding

```typescript
// Child component
readonly value = model(0);

increment() {
  this.value.update(v => v + 1); // propagates to parent
}

// Parent template
<child [(value)]="parentSignal" />
```

- Creates implicit `valueChange` output
- Parent must bind to signal instance, not value

---

## Template Queries

### viewChild() / viewChildren()

```typescript
readonly input = viewChild<ElementRef>('inputRef');
readonly input = viewChild.required<ElementRef>('inputRef');
readonly items = viewChildren<ItemComponent>(ItemComponent);
```

### contentChild() / contentChildren()

```typescript
readonly header = contentChild<TemplateRef<unknown>>('header');
readonly tabs = contentChildren<TabComponent>(TabComponent);
```

- Return signals (call to get value)
- Available after view init

---

## Async Data (Experimental)

### resource() - Generic Async Loading

```typescript
readonly userId = input.required<string>();

readonly user = resource({
  params: () => ({ id: this.userId() }),
  loader: ({ params, abortSignal }) =>
    fetch(`/api/users/${params.id}`, { signal: abortSignal })
      .then(r => r.json())
});

// Access
this.user.value();      // data or undefined
this.user.hasValue();   // boolean guard
this.user.error();      // error or undefined
this.user.isLoading();  // boolean
this.user.status();     // 'idle'|'loading'|'reloading'|'resolved'|'error'|'local'
this.user.reload();     // trigger refresh
```

### httpResource() - HTTP with Signals

```typescript
readonly user = httpResource(() => `/api/users/${this.userId()}`);

// Advanced request
readonly user = httpResource(() => ({
  url: `/api/users/${this.userId()}`,
  method: 'GET',
  headers: { 'X-Custom': 'value' }
}));

// With validation (Zod)
readonly user = httpResource(() => `/api/users/${this.userId()}`, {
  parse: userSchema.parse
});

// Response types
httpResource.text(() => url);
httpResource.blob(() => url);
httpResource.arrayBuffer(() => url);
```

### rxResource() - RxJS Integration

```typescript
readonly user = rxResource({
  params: () => this.userId(),
  stream: ({ params }) => this.http.get<User>(`/api/users/${params}`)
});
```

---

## Side Effects

### effect() - Last Resort API

```typescript
constructor() {
  effect(() => {
    console.log(`User: ${this.user()}`);
  });
}
```

**Valid uses:**

- Logging/analytics
- Sync to localStorage/sessionStorage
- Custom DOM behavior
- Third-party library integration

**NEVER use for:**

- State propagation between signals
- Deriving values (use `computed()`)
- Setting other signals (use `linkedSignal()`)

### afterRenderEffect() - DOM Manipulation

```typescript
constructor() {
  afterRenderEffect({
    write: () => this.chart.updateData(this.chartData())
  });
}
```

**Phases:** `earlyRead` → `write` → `mixedReadWrite` → `read`

### effect() Cleanup

```typescript
effect((onCleanup) => {
  const timer = setTimeout(() => {}, 1000);
  onCleanup(() => clearTimeout(timer));
});
```

---

## RxJS Interop

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// Observable → Signal
readonly user = toSignal(this.user$);
readonly user = toSignal(this.user$, { initialValue: null });

// Signal → Observable
readonly user$ = toObservable(this.userSignal);
```

### takeUntilDestroyed()

```typescript
constructor() {
  this.data$.pipe(
    takeUntilDestroyed()
  ).subscribe(d => this.process(d));
}
```

---

## Signal Forms (Experimental)

```typescript
import { signal } from '@angular/core';
import { form, Field } from '@angular/forms/signals';

@Component({
  imports: [Field],
  template: `
    <input [field]="loginForm.email" />
    <input type="password" [field]="loginForm.password" />
  `
})
export class LoginComponent {
  readonly model = signal({ email: '', password: '' });
  readonly loginForm = form(this.model);

  onSubmit() {
    const data = this.model();
    // submit data
  }
}
```

**Field state access:**

```typescript
this.loginForm.email().value();     // current value
this.loginForm.email().valid();     // validation state
this.loginForm.email().touched();   // interaction state
this.loginForm.email().value.set(''); // programmatic update
```

---

## Patterns

### Service State Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class CounterService {
  private readonly _count = signal(0);

  readonly count = this._count.asReadonly();
  readonly doubled = computed(() => this._count() * 2);

  increment() { this._count.update(c => c + 1); }
  reset() { this._count.set(0); }
}
```

### Component Pattern

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ greeting() }}`
})
export class GreetingComponent {
  readonly name = input.required<string>();
  readonly prefix = input('Hello');
  readonly greeted = output<string>();

  readonly greeting = computed(() => `${this.prefix()}, ${this.name()}!`);
}
```

---

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `effect(() => this.b.set(this.a()))` | `b = computed(() => this.a())` or `b = linkedSignal(() => this.a())` |
| `signal.mutate(arr => arr.push(x))` | `signal.update(arr => [...arr, x])` |
| Read signal in constructor before init | Use `afterNextRender()` or `effect()` |
| `toSignal()` without `initialValue` when sync needed | Provide `initialValue` or handle `undefined` |
| `effect()` for derived state | `computed()` for read-only, `linkedSignal()` for writable |
| Subscribe in component without cleanup | `takeUntilDestroyed()` or `toSignal()` |

---

## Quick Reference

| API | Import | Purpose |
|-----|--------|---------|
| `signal()` | `@angular/core` | Writable state |
| `computed()` | `@angular/core` | Derived read-only state |
| `linkedSignal()` | `@angular/core` | Derived writable state |
| `effect()` | `@angular/core` | Side effects (use sparingly) |
| `input()` | `@angular/core` | Component input |
| `output()` | `@angular/core` | Component output |
| `model()` | `@angular/core` | Two-way binding |
| `viewChild()` | `@angular/core` | Template query |
| `contentChild()` | `@angular/core` | Projected content query |
| `resource()` | `@angular/core` | Async data (experimental) |
| `httpResource()` | `@angular/common/http` | HTTP requests (experimental) |
| `rxResource()` | `@angular/core/rxjs-interop` | RxJS async data |
| `toSignal()` | `@angular/core/rxjs-interop` | Observable → Signal |
| `toObservable()` | `@angular/core/rxjs-interop` | Signal → Observable |
| `untracked()` | `@angular/core` | Read without tracking |
| `form()` | `@angular/forms/signals` | Signal forms (experimental) |
