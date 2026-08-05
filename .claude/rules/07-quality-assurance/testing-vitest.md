---
description: "Vitest testing patterns with Angular TestBed"
paths:
  - "**/*.spec.ts"
  - "**/e2e/**/*.ts"
---

# Testing

Vitest + Angular TestBed, spec files next to the code they test. Standard TestBed usage
applies as written — `configureTestingModule`, `componentRef.setInput()` for signal inputs,
`vi.fn()` spies, Arrange-Act-Assert. Test code and descriptions in **English**, named
`should + expected behaviour`.

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
| `TestBed.inject()` for a component-scoped provider | `fixture.debugElement.injector.get()` |
| A hand-written `DataCache` mock | `createMockDataCache()` |
| Magic strings/numbers | Constants or factory functions |
| Comments explaining a test | A self-explanatory test name |
| `any` in test code | Proper types |
