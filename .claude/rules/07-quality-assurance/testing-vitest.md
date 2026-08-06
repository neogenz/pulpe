---
description: "Vitest testing patterns with Angular TestBed"
paths:
  - "**/*.spec.ts"
  - "**/e2e/**/*.ts"
---

# Testing

Vitest + Angular TestBed, spec files next to the code they test. Standard TestBed usage
applies as written — `configureTestingModule`, `vi.fn()` spies, Arrange-Act-Assert. Test code
and descriptions in **English**, named `should + expected behaviour`. The one documented API
that does *not* work here is `componentRef.setInput()`, below.

## Signal inputs do not exist in these specs

`pnpm test` runs Vitest directly through `frontend/vitest.config.ts`, which registers no
Angular plugin, so specs compile through runtime **JIT**. `input()`, `output()`, `model()`
and `viewChild()` are initializer-based APIs that JIT cannot see: it builds the component
definition from the `@Component` decorator when the class is *defined*, while those fields
only run when an instance is *constructed*. Measured on Angular 22.0.7, a component whose
only input is `input.required<string>()` compiles to `ɵcmp.inputs = {}`, where the same
component written with `@Input()` yields `{ label: [...] }`.

Two consequences, both silent:

- **`componentRef.setInput()` does nothing.** It neither throws nor writes; the signal keeps
  its initial value.
- **A template binding lands on the DOM element instead.** `[goalName]="x"` ends up as
  `element.goalName`, so the child renders nothing. `errorOnUnknownProperties: false` in
  `test-setup.ts` and the stderr suppression in `vitest.config.ts` swallow the warning that
  would otherwise say so.

Write inputs with `setTestInput()` from `@app/testing/signal-test-utils.ts`, which writes
through the signal's internal node. When the value reaches a *child* by binding, query the
child and push it in by hand:

```typescript
const line = fixture.debugElement.query(By.directive(SavingsGoalSourceLine));
setTestInput(line.componentInstance.goalName, 'Vacances');
fixture.detectChanges();
```

**No spec can assert what a child renders from a bound signal input** — binding the wrong
field stays green. That assertion belongs in an e2e test, the only level where a real
`ng build` compiles the template; see `e2e/tests/features/savings-goal-withdrawals.spec.ts`.

`angular.json` already declares an AOT test target (`@angular/build:unit-test`, runner
`vitest`) free of this limitation, which `package.json` does not use. Switching is a config
change plus ~17 of 206 spec files, most of them `vi.mock` module mocks that esbuild bundling
breaks.

## Resolve from the component injector, not TestBed root

A component with its own `providers` (a locale adapter, a scoped store, a dialog service)
resolves them from *its* injector. `TestBed.inject()` reads the root injector and hands back
the wrong instance — silently, with a plausible value:

```typescript
// Right — the same injector the component's own datepicker uses
const adapter = fixture.debugElement.injector.get(DateAdapter);
const formats = fixture.debugElement.injector.get(MAT_DATE_FORMATS);

// Wrong — root injector, not what the component sees
const adapter = TestBed.inject(DateAdapter);
```

## Never hand-roll a DataCache double

`createMockDataCache()` in `core/testing/test-utils.ts` tracks the `ngx-ziflux` `DataCache`
surface. A hand-rolled object compiles today and drifts on the next upgrade, so the spec goes
green while the real cache has moved. `pnpm typecheck:spec` is the only gate that compiles
spec files — plain `pnpm typecheck` will not see the break.

## Stale specs after a shared rebuild

Vitest caches transformed modules in `node_modules/.vite`. After rebuilding `shared/`, a spec
can run against the previous build with no warning. Clear that directory when a test result
contradicts the source you just changed.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Test implementation details | Test behaviour and outcomes |
| Share mutable state between tests | Reset in `beforeEach` |
| `componentRef.setInput()` on a signal input | `setTestInput()` from `@app/testing/signal-test-utils` |
| Asserting text a child renders from a bound input | An e2e test |
| `TestBed.inject()` for a component-scoped provider | `fixture.debugElement.injector.get()` |
| A hand-written `DataCache` mock | `createMockDataCache()` |
| Magic strings/numbers | Constants or factory functions |
| Comments explaining a test | A self-explanatory test name |
| `any` in test code | Proper types |
