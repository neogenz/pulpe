# Angular 21 Anti-Patterns Checklist

> Scanning checklist for step-01. Each entry includes the anti-pattern, what to replace it with, and the authoritative source.

---

## 1. Component Anti-Patterns

| # | Anti-Pattern | Modern (Angular 21) | Severity | Source |
|---|-------------|---------------------|----------|--------|
| 1.1 | `@Input()` decorator | `input()` / `input.required()` | 🟡 | angular.dev/guide/components/inputs |
| 1.2 | `@Output()` decorator | `output()` | 🟡 | angular.dev/guide/components/outputs |
| 1.3 | `@Input` + `@Output` for 2-way binding | `model()` | 🟡 | angular.dev/guide/signals/inputs#model-inputs |
| 1.4 | `@ViewChild()` / `@ViewChildren()` | `viewChild()` / `viewChildren()` | 🟡 | angular.dev/guide/components/queries |
| 1.5 | `@ContentChild()` / `@ContentChildren()` | `contentChild()` / `contentChildren()` | 🟡 | angular.dev/guide/components/queries |
| 1.6 | `@HostBinding()` / `@HostListener()` | `host: {}` in component metadata | 🟡 | angular.dev/guide/components/host-elements |
| 1.7 | `ChangeDetectionStrategy.Default` | `ChangeDetectionStrategy.OnPush` | 🔴 | Angular best practices |
| 1.8 | Component > 300 lines | Split into smaller components | 🟡 | `.claude/rules/clean-code.md` |
| 1.9 | Function > 30 lines | Extract into smaller functions | 🟡 | Same |
| 1.10 | > 5 function parameters | Use options object | 🟡 | Same |

**Grep patterns:**
```bash
grep -n "@Input(" "$file"
grep -n "@Output(" "$file"
grep -n "@ViewChild(" "$file"
grep -n "@ContentChild(" "$file"
grep -n "@HostBinding(" "$file"
grep -n "@HostListener(" "$file"
grep -n "ChangeDetectionStrategy" "$file"
```

---

## 2. Signal Anti-Patterns

| # | Anti-Pattern | Modern (Angular 21) | Severity | Source |
|---|-------------|---------------------|----------|--------|
| 2.1 | `effect()` for derived state | `computed()` | 🔴 | `.claude/rules/frontend/signals.md` |
| 2.2 | `effect()` to sync signals | `linkedSignal()` | 🔴 | angular.dev/guide/signals/linked-signal |
| 2.3 | `signal.mutate(arr => arr.push(x))` | `signal.update(arr => [...arr, x])` | 🔴 | angular.dev/guide/signals |
| 2.4 | Public mutable signal | Private `#signal` + `.asReadonly()` or `computed()` | 🟡 | Store pattern convention |
| 2.5 | `BehaviorSubject` for component state | `signal()` + `computed()` | 🟡 | Signal migration |
| 2.6 | Subscribe without cleanup | `takeUntilDestroyed()` or `toSignal()` | 🔴 | angular.dev/ecosystem/rxjs-interop |
| 2.7 | `toSignal()` without `initialValue` (sync) | Provide `initialValue` | 🟡 | Signal best practices |
| 2.8 | Read signal in constructor before init | `afterNextRender()` or `effect()` | 🔴 | Signal best practices |

**Grep patterns:**
```bash
grep -n "effect(" "$file"
grep -n "\.mutate(" "$file"
grep -n "BehaviorSubject" "$file"
grep -n "\.subscribe(" "$file"
grep -n "toSignal(" "$file"
```

---

## 3. Template Anti-Patterns

| # | Anti-Pattern | Modern (Angular 21) | Severity | Source |
|---|-------------|---------------------|----------|--------|
| 3.1 | `*ngIf` | `@if` | 🟡 | angular.dev/guide/templates/control-flow |
| 3.2 | `*ngFor` | `@for` (with `track` expression) | 🟡 | Same |
| 3.3 | `*ngSwitch` | `@switch` | 🟡 | Same |
| 3.4 | `[ngClass]="{ 'active': isActive }"` | `[class.active]="isActive()"` | 🟡 | Project convention |
| 3.5 | `[ngStyle]` | `[style.prop]` or Tailwind class | 🟡 | Project convention |
| 3.6 | `@for` without `track` | Add `track item.id` or `track $index` | 🔴 | angular.dev/guide/templates/control-flow |

**Grep patterns:**
```bash
grep -n "\*ngIf" "$file"
grep -n "\*ngFor" "$file"
grep -n "\*ngSwitch" "$file"
grep -n "\[ngClass\]" "$file"
grep -n "\[ngStyle\]" "$file"
```

---

## 4. Dependency Injection Anti-Patterns

| # | Anti-Pattern | Modern (Angular 21) | Severity | Source |
|---|-------------|---------------------|----------|--------|
| 4.1 | `constructor(private x: Service)` | `readonly #x = inject(Service)` | 🟡 | angular.dev/guide/di |
| 4.2 | `constructor(private x, private y, ...)` | `inject()` for each | 🟡 | Same |
| 4.3 | Service not `providedIn: 'root'` (singleton) | Add `providedIn: 'root'` or component-level provider | 🟡 | angular.dev/guide/di/hierarchical-dependency-injection |

**Grep patterns:**
```bash
grep -n "constructor(private" "$file"
grep -n "constructor(" "$file"
```

---

## 5. Architecture Anti-Patterns (Pulpe-specific)

| # | Anti-Pattern | Fix | Severity | Source |
|---|-------------|-----|----------|--------|
| 5.1 | `feature/x` imports from `feature/y` | Extract shared code to `pattern/` or `core/` | 🔴 | `.claude/rules/00-architecture/angular-architecture.md` |
| 5.2 | `ui/` imports from `core/` | Remove service dependency, pass data via `input()` | 🔴 | Same |
| 5.3 | `ui/` imports from `pattern/` | UI must be self-contained | 🔴 | Same |
| 5.4 | `pattern/` imports from `feature/` | Invert dependency direction | 🔴 | Same |
| 5.5 | `pattern/` imports from `pattern/` | Patterns don't depend on each other | 🔴 | Same |
| 5.6 | `core/` imports from `feature/` | Core is lower level | 🔴 | Same |
| 5.7 | `core/` imports from `pattern/` | Core is lower level | 🔴 | Same |
| 5.8 | `layout/` imports from `feature/` | Layout is shared | 🔴 | Same |
| 5.9 | Circular dependency | Restructure to one-way flow | 🔴 | `docs/angular-architecture-doc.md` |

**Detection strategy:**
- Parse imports in each file
- Check if import path crosses forbidden boundary
- Report with file:line and the forbidden import path

---

## 6. TypeScript Anti-Patterns

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 6.1 | `private field` | `#field` (native private) | 🟡 | Project convention |
| 6.2 | `any` type | `unknown` + type guard | 🔴 | `.claude/rules/shared/typescript.md` |
| 6.3 | `as Type` assertion | Type guard or generic | 🟡 | Same |
| 6.4 | `JSON.parse(JSON.stringify())` | `structuredClone()` | 🟡 | ES2025 |
| 6.5 | Mutating `.sort()` / `.reverse()` | `.toSorted()` / `.toReversed()` | 🟡 | ES2025 |
| 6.6 | Manual `reduce` for grouping | `Object.groupBy()` | 🟡 | ES2025 |
| 6.7 | Commented-out code | Delete it | 🟡 | Clean code |
| 6.8 | Magic numbers | Named constants | 🟡 | Clean code |

**Grep patterns:**
```bash
grep -n "private \w" "$file"
grep -n ": any" "$file"
grep -n "as [A-Z]" "$file"
grep -n "JSON.parse(JSON.stringify" "$file"
grep -n "\.sort()" "$file"
grep -n "\.reverse()" "$file"
```

---

## 7. Styling Anti-Patterns

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 7.1 | `::ng-deep` | CSS custom properties / `var(--mat-sys-*)` | 🔴 | material.angular.dev/guide/theming |
| 7.2 | `mat-button` (legacy attribute) | `matButton="filled"` | 🟡 | material.angular.dev/components/button |
| 7.3 | `bg-[--var]` (Tailwind v3) | `bg-(--var)` (Tailwind v4) | 🟡 | tailwindcss.com/docs/upgrade-guide |
| 7.4 | `!important` | CSS specificity or `@layer` | 🟡 | CSS best practices |
| 7.5 | Inline `style=""` | Tailwind classes or component styles | 🟡 | Project convention |

**Grep patterns:**
```bash
grep -n "::ng-deep" "$file"
grep -n '!important' "$file"
grep -n 'bg-\[--' "$file"
grep -n 'style="' "$file"
```

---

## 8. Security Anti-Patterns

| # | Anti-Pattern | Fix | Severity | Source |
|---|-------------|-----|----------|--------|
| 8.1 | `innerHTML` binding | `[innerText]` or sanitize | 🔴 | OWASP XSS prevention |
| 8.2 | `bypassSecurityTrust*` | Proper sanitization | 🔴 | Same |
| 8.3 | Raw `console.log` | Logger service | 🟡 | `@core/logging/logger.ts` |

**Grep patterns:**
```bash
grep -n "innerHTML" "$file"
grep -n "bypassSecurity" "$file"
grep -n "console\." "$file"
```

---

## 9. Testing Anti-Patterns

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 9.1 | No AAA structure | Arrange / Act / Assert comments | 🟡 | `.claude/rules/testing/vitest.md` |
| 9.2 | `it('test 1')` | `it('should X when Y')` | 🟡 | Same |
| 9.3 | `id="btn"` for test queries | `data-testid="..."` | 🟡 | Same |
| 9.4 | Testing implementation details | Test behavior/output | 🟡 | Testing best practices |

---

## 10. Naming Anti-Patterns

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 10.1 | `loading` (boolean) | `isLoading` | 🟡 | `.claude/rules/naming-conventions.md` |
| 10.2 | `item` (array variable) | `items` | 🟡 | Same |
| 10.3 | `data` (vague name) | Descriptive name (`users`, `transactions`) | 🟡 | Clean code |

---

## 11. Zod Integration Anti-Patterns

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 11.1 | No validation at boundary | `schema.parse(data)` | 🔴 | zod.dev |
| 11.2 | Manual type definition | `z.infer<typeof schema>` | 🟡 | Same |
| 11.3 | Import types from backend | Import from `pulpe-shared` | 🟡 | `memory-bank/ARCHITECTURE.md` |

---

## 12. Store Pattern Anti-Patterns

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 12.1 | No 6-section anatomy in store | Follow: Dependencies → State → Resource → Selectors → Mutations → Private utils | 🟡 | `.claude/rules/03-frameworks-and-libraries/angular-store-pattern.md` |
| 12.2 | `inject(HttpClient)` in store/service | `inject(ApiClient)` — Zod validation enforced by design | 🔴 | Same |
| 12.3 | `subscribe()` in store mutations | `async/await` + `firstValueFrom()` | 🔴 | Same |
| 12.4 | `providedIn: 'root'` on feature store | `@Injectable()` + route providers | 🔴 | Same |
| 12.5 | Manual stale data signal in store | Cache fallback via `api.cache.get()` in selector | 🟡 | Same |
| 12.6 | Cascade before replacing temp ID | Replace temp → real ID BEFORE invalidation/cascade | 🔴 | Same (DR-005) |
| 12.7 | Public mutable state in store | Private `#state` signal + public `computed()` selectors | 🔴 | Store pattern |

---

## 13. ViewModel Anti-Patterns

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 13.1 | `.filter()`/`.reduce()` in template | `computed()` in store | 🔴 | `references/viewmodel-patterns.md` |
| 13.2 | Transformation `computed()` in component | Move to store — shared, testable | 🟡 | Same |
| 13.3 | Store returns formatted strings | Store returns data, template formats via pipe | 🟡 | Same |
| 13.4 | Duplicate derivations across components | Shared store selector | 🟡 | Same |
| 13.5 | God ViewModel object (`computed(() => ({...20 fields}))`) | Separate `computed()` per concern | 🔴 | Same |
| 13.6 | Manual ViewModel in `ngOnInit` | `computed()` signals — reactive | 🔴 | Same |

---

## 14. AI Slop Anti-Patterns

| # | Anti-Pattern | Fix | Severity | Source |
|---|-------------|-----|----------|--------|
| 14.1 | Comments restating code | Delete — code should be self-documenting | 🟡 | `references/ai-slop-detection.md` |
| 14.2 | Over-engineered abstraction (single consumer) | Inline it | 🟡 | Same |
| 14.3 | Defensive null check on DI/typed value | Remove — trust the type system | 🟡 | Same |
| 14.4 | `try/catch` on non-throwing code | Remove — signals/navigation don't throw | 🟡 | Same |
| 14.5 | Single-use helper function | Inline | 🟡 | Same |
| 14.6 | JSDoc that repeats TypeScript types | Delete | 🟡 | Same |
| 14.7 | Verbose variable name (>25 chars) | Shorten — proportional to scope | 🟡 | Same |

---

## 15. Workarounds & Framework Hacks

These patterns indicate the developer fought the framework instead of working with it. They compile and run, but they mask real bugs or design problems.

| # | Anti-Pattern | Why It's Bad | Fix | Severity | Source |
|---|-------------|-------------|-----|----------|--------|
| 15.1 | `setTimeout(() => ..., 0)` | Change detection hack — masks a reactivity bug | Restructure to signal flow or `afterNextRender()` | 🔴 | angular.dev/best-practices |
| 15.2 | `ChangeDetectorRef.detectChanges()` | Forces sync CD — usually means signals aren't wired correctly | Fix the signal/async pipe chain | 🔴 | Same |
| 15.3 | `ChangeDetectorRef.markForCheck()` | Sometimes valid, but often a signal would solve it | Evaluate if a `computed()` or `toSignal()` is better | 🟡 | Same |
| 15.4 | `@ts-ignore` / `@ts-expect-error` | Bypasses the type system entirely — pure debt | Fix the type error or properly type the code | 🔴 | TypeScript best practices |
| 15.5 | `as any` cast | Throws away all type safety at that point | Use `unknown` + type guard, or fix the generic | 🔴 | Same |
| 15.6 | `eslint-disable` without explanation | Hides a real issue behind a suppression | Fix the lint error, or add a WHY comment | 🟡 | ESLint best practices |
| 15.7 | `zone.runOutsideAngular()` | Sometimes valid (perf), but often a hack to avoid proper CD | Evaluate if OnPush + signals solves the real issue | 🟡 | angular.dev/best-practices |
| 15.8 | `ngAfterViewInit` for state initialization | Should be reactive — `effect()` or `afterNextRender()` | Use signal primitives for reactive init | 🟡 | angular.dev/style-guide |
| 15.9 | `document.querySelector()` in component | Bypasses Angular's view abstraction entirely | Use `viewChild()` or `ElementRef` with `inject()` | 🔴 | angular.dev/best-practices |
| 15.10 | `window.location` for navigation | Breaks SPA routing, loses app state | Use `Router.navigate()` | 🔴 | angular.dev/guide/routing |

**Grep patterns:**
```bash
grep -n "setTimeout" "$file"
grep -n "detectChanges" "$file"
grep -n "markForCheck" "$file"
grep -n "@ts-ignore" "$file"
grep -n "@ts-expect-error" "$file"
grep -n "as any" "$file"
grep -n "eslint-disable" "$file"
grep -n "runOutsideAngular" "$file"
grep -n "document\." "$file"
grep -n "window\.location" "$file"
```

---

## 16. Design Smells

These aren't syntax issues — they're structural problems that make the codebase harder to maintain, extend, and test. A linter won't catch them. Only a developer who understands the domain will.

| # | Smell | Detection | Severity | Source |
|---|-------|-----------|----------|--------|
| 16.1 | **God Component** — component with 6+ `inject()` calls, doing multiple unrelated things | Count `inject()` calls; check if component handles multiple concerns (data loading + form + navigation + analytics) | 🔴 | Clean code / SRP |
| 16.2 | **Feature Envy** — method that accesses 5+ properties of another object | A method that chains through `budget.lines[0].category.name` repeatedly — the logic probably belongs closer to the data | 🟡 | Refactoring / Fowler |
| 16.3 | **Primitive Obsession** — using `string` where a domain type should exist | `budgetId: string` everywhere instead of a branded type or distinct type; `status: string` instead of `'active' \| 'archived'` | 🟡 | TypeScript best practices |
| 16.4 | **Shotgun Surgery** — a single business change requires modifying 5+ files | Adding a field requires touching schema, backend, shared type, store, component, template, test — check if abstractions are missing | 🟡 | Refactoring / Fowler |
| 16.5 | **Dead Feature** — route, component, or service that is no longer reachable | Component not referenced in any route or template; service never injected | 🟡 | Clean code |
| 16.6 | **Inappropriate Intimacy** — two classes that know too much about each other's internals | Component directly mutating store private state; service reaching into another service's internals | 🔴 | Refactoring / Fowler |
| 16.7 | **Long Parameter List** — method with 4+ parameters | Especially in store mutations or service methods — use an options/config object or a domain type | 🟡 | Clean code |
| 16.8 | **Duplicated Derivation** — same transformation logic in 2+ places | Two components both filtering budget lines by type — should be a shared store selector | 🟡 | DRY / ViewModel patterns |

---

## 17. Angular Style Guide Violations

Official conventions from angular.dev/style-guide that affect code quality.

| # | Anti-Pattern | Modern | Severity | Source |
|---|-------------|--------|----------|--------|
| 17.1 | Template-only member is `public` | `protected` for template-only | 🟡 | angular.dev/style-guide |
| 17.2 | Missing `readonly` on `input()`, `output()`, `model()`, queries | Add `readonly` | 🟡 | Same |
| 17.3 | Event handler named by event (`handleClick`, `onClick`) | Name by action (`saveData`, `deleteBudget`) | 🟡 | Same |
| 17.4 | Properties and methods mixed randomly | Angular properties first, then methods | 🟡 | Same |
| 17.5 | `ngOnInit` without `implements OnInit` | Add lifecycle interface | 🟡 | Same |
| 17.6 | Complex logic directly in lifecycle hook (>10 lines) | Delegate to well-named methods | 🟡 | Same |
| 17.7 | Empty lifecycle hook (`ngOnInit() {}`) | Remove entirely — dead code | 🟡 | Clean code |
| 17.8 | Multiple classes/concepts in one file | One concept per file, split | 🟡 | angular.dev/style-guide |

For detailed reference: see `references/angular-style-guide.md`.

---

## 18. Error Handling Anti-Patterns

Errors should be surfaced at the callsite — the code that initiated the operation has the context to handle it. The global `ErrorHandler` is for unexpected/fatal errors only (logging, analytics), not for recoverable flow.

| # | Anti-Pattern | Why It's Bad | Fix | Severity | Source |
|---|-------------|-------------|-----|----------|--------|
| 18.1 | Empty `catch` block — `catch (e) {}` | Swallows the error silently, user gets no feedback, devs get no signal | Handle the error: display message, revert state, or rethrow with context | 🔴 | angular.dev/best-practices/error-handling |
| 18.2 | `catch (e: any)` — untyped error | Loses all type information, leads to unsafe property access | Use `unknown` + type narrowing (`isApiError()`, `instanceof`, Zod schema) | 🟡 | TypeScript best practices |
| 18.3 | `async` store method without `try/catch` around API call | Error bubbles unhandled — resource state becomes corrupted, UI hangs | Wrap callsite in `try/catch`, handle loading/error state, revert optimistic updates | 🔴 | angular.dev/best-practices/error-handling |
| 18.4 | `resource()` / `httpResource()` without checking `.error()` in template | User sees stale data or empty screen on failure, no error feedback | Check `resource.error()` or `resource.status()` in template with `@if` | 🔴 | angular.dev/api/core/resource |
| 18.5 | Zod `.parse()` without error boundary at non-API callsite | `.parse()` throws `ZodError` on invalid data — unhandled in component code | Use `.safeParse()` for graceful handling, or `.parse()` only in `httpResource({ parse })` where Angular handles it | 🟡 | Zod docs |
| 18.6 | Relying on global `ErrorHandler` for recoverable errors | Global handler has no context to recover — can only log and hope | Handle at callsite: `try/catch` for promises, `catchError` for Observables | 🔴 | angular.dev/best-practices/error-handling |
| 18.7 | `firstValueFrom()` without `catch` | Promise rejection goes unhandled if Observable errors | Wrap in `try/catch` or chain `.catch()` | 🟡 | RxJS docs |
| 18.8 | `catchError` that returns `EMPTY` or `of(null)` without notifying user | Error is "handled" but user has no idea something failed | At minimum: log + notify user (toast/snackbar), then recover or rethrow | 🟡 | RxJS best practices |

**What NOT to flag:**
- `try/catch` around actual async API calls — that's correct
- `catchError` in RxJS pipes for HTTP errors with proper recovery — that's correct
- `.parse()` in `httpResource({ parse })` option — Angular handles the error via resource status
- `resource()` that checks `.status()` === `'error'` — that's correct

---

## Priority Order

**Scan in this order (highest impact first):**

1. 🔴 Security (innerHTML, bypassSecurity)
2. 🔴 Error handling (silent catch, unhandled async, missing resource error state)
3. 🔴 Workarounds & hacks (setTimeout(0), detectChanges, @ts-ignore, as any)
4. 🔴 Architecture violations (cross-feature imports, forbidden deps)
5. 🔴 Design smells (god component, inappropriate intimacy)
6. 🔴 Signal misuse (effect for derived, mutation, missing cleanup)
7. 🔴 Store pattern violations (HttpClient direct, subscribe in mutations, public mutable state)
8. 🔴 ViewModel violations (template expressions, god ViewModel, manual construction)
9. 🔴 Missing OnPush
10. 🔴 `any` types
11. 🟡 AI Slop (comments, over-engineering, defensive theater)
12. 🟡 Angular style guide (protected, readonly, handler naming, member order)
13. 🟡 Legacy Angular patterns (decorators → functions)
14. 🟡 TypeScript modernization
15. 🟡 Styling issues
16. 🟡 Naming conventions
17. 🟡 Testing patterns
