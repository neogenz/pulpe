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

## `pnpm test` is `ng test`, and the specs compile ahead of time

`@angular/build:unit-test` builds the specs with `ngtsc` and hands the output to Vitest, so
running the `vitest` CLI directly skips the compiler. Everything the AOT compiler knows
therefore holds in a spec: signal inputs are real inputs, template bindings reach children,
`templateUrl`/`styleUrl` resolve, and an unknown property raises `NG0303` instead of silently
becoming a DOM attribute.

Configuration lives in the `test` target of `frontend/angular.json` — setup file, coverage,
and a `runnerConfig` pointing at `frontend/vitest-base.config.ts`, which carries only the
timeouts the builder does not expose. Put new settings in `angular.json` and leave that file
alone unless the builder genuinely has no option for what you need. The setup file must not
call `initTestEnvironment` — the builder owns it.

Compiling for real also means the components under test really run, so anything jsdom lacks
now gets reached: `test-setup.ts` stubs the 2D canvas and `IntersectionObserver` for that
reason. Expect the same for the next browser API a component touches from
`afterNextRender`.

## Mock through DI, never through the module

The builder bundles first-party code with esbuild, so a call site is resolved to a direct
binding before Vitest ever sees it and there is nothing left to intercept. A relative path is
rejected outright — *"Please use Angular TestBed for mocking dependencies"*. A path alias
fails one of two ways, and the second is the dangerous one:

- `vi.mock('@core/encryption/crypto.utils')` throws `Cannot redefine property`.
- `vi.mock('@core/encryption')`, the barrel, throws nothing and **does nothing**. The suite
  stays green while the component runs the real implementation.

So a green suite is not evidence that a module mock works. To check one, make it reject and
confirm the test fails; if it still passes, the mock was never installed. Mocking a bare npm
package does work — those stay external to the bundle.

A module-level function a component calls directly therefore needs a DI seam. Give it an
`InjectionToken` whose factory returns the real function, matching `PAGE_RELOAD`:

```typescript
export const DERIVE_CLIENT_KEY = new InjectionToken<typeof deriveClientKey>(
  'DERIVE_CLIENT_KEY',
  { providedIn: 'root', factory: () => deriveClientKey },
);
```

Existing seams: `DERIVE_CLIENT_KEY` (`core/encryption/crypto.utils.ts`),
`SUPABASE_CLIENT_FACTORY` (`core/auth/`), `CURRENT_APP_VERSION` (`core/app-version/`),
`PAGE_RELOAD` (`core/page-reload.ts`). Reuse one before adding another.

A token carries one function or one value. When the untestable part is a *set* of related
operations, the seam is a service — `FileDownloadService` (`core/file-download.ts`) holds
`asJson` and `asExcel` for exactly that reason. A token holding an object with methods is a
service written the long way round.

`setTestInput()` in `@app/testing/signal-test-utils.ts` predates the AOT runner and still
works; new specs do not need it.

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

## Specs read `shared/` as built, not as source

`pulpe-shared` resolves through its `exports` field to `shared/dist/esm`, so a change to
`shared/src` is invisible to the specs until that package is rebuilt. `turbo test` depends on
`^build` and handles it; running `pnpm test` inside `frontend/` alone does not. Run
`pnpm build:shared` first when a test result contradicts the source you just changed.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Test implementation details | Test behaviour and outcomes |
| Share mutable state between tests | Reset in `beforeEach` |
| `vi.mock()` / `vi.spyOn()` on a `@core` module | An `InjectionToken` seam, provided in TestBed |
| `TestBed.inject()` for a component-scoped provider | `fixture.debugElement.injector.get()` |
| A hand-written `DataCache` mock | `createMockDataCache()` |
| Magic strings/numbers | Constants or factory functions |
| Comments explaining a test | A self-explanatory test name |
| `any` in test code | Proper types |
