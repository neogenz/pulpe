# AI Slop Detection Guide

> Reference for identifying AI-generated code patterns that a senior developer would never write by hand.
> These patterns pass linting and type-checking but add noise, complexity, and maintenance burden.

---

## The Litmus Test

For every line of code, ask: **"Would a senior developer who cares about their craft write this?"**

If the answer is "a junior might, but a senior wouldn't bother" — it's slop.

---

## 1. Over-Commenting

AI loves to explain the obvious. A senior trusts the reader to understand code.

| Slop | Clean |
|------|-------|
| `// Set loading to true` above `this.#state.set(true)` | _(no comment — the code says it)_ |
| `// Create a new budget` above `createBudget()` call | _(the method name says it)_ |
| `/** Returns the budget name */` on a getter | _(self-documenting)_ |
| `// ---- Actions ----` section dividers | _(use the 6-section store anatomy comments only)_ |

**Detection:** Comments that restate what the next line does. JSDoc on obvious methods. Section dividers in files under 100 lines. Multi-line comments that could be a single line.

**Rule:** Comments explain WHY, never WHAT. If the code needs a WHAT comment, rewrite the code to be clearer.

---

## 2. Over-Engineering

AI defaults to "flexible" and "configurable" even when the requirement is simple.

| Slop | Clean |
|------|-------|
| Factory function for a single implementation | Direct instantiation |
| Options object with 1 property | Single parameter |
| Generic wrapper around a framework function | Use the framework directly |
| Abstract base class with one child | Just the concrete class |
| `config.ts` exporting a single constant | Inline the constant |
| Strategy pattern with one strategy | Direct call |
| `interface` + `class` when just `class` would do | Just the class |
| `enum` for 2 values | Boolean or union type |

**Detection:**
- Classes/functions with a single consumer
- Abstractions that pass through without transforming (wrappers that just delegate)
- Generics with only one concrete type ever used
- Files containing a single export that could be inlined
- "Utility" modules with 1-2 functions

**Rule:** Three similar lines of code is better than a premature abstraction. Only abstract with 3+ concrete uses.

---

## 3. Defensive Programming Theater

AI adds safety checks for scenarios that can't happen — it doesn't trust the type system or framework guarantees.

| Slop | Clean |
|------|-------|
| `if (store !== null && store !== undefined)` — store is `inject()`ed | Direct access — DI guarantees it |
| `try/catch` around `signal.set()` | Direct call — signals don't throw |
| `?? []` on `signal<Item[]>([])` | The signal already has `[]` as default |
| Null check on `input.required()` | Angular guarantees it's set |
| `if (typeof x === 'string')` when `x: string` | TypeScript already guarantees it |
| Fallback value on `computed()` fed by non-nullable chain | Trust the signal chain |
| `?.` on injected services | DI guarantees non-null |

**Detection:**
- `!= null` / `!= undefined` on DI-injected or type-guaranteed values
- `try/catch` around synchronous, non-throwing code
- Optional chaining `?.` on non-optional types
- Nullish coalescing `??` on signals with explicit defaults
- Type guards on already-typed parameters
- Error states for operations that have no failure path

**Rule:** Trust the type system. Trust Angular's DI. Trust signal initialization. Validate only at system boundaries (user input, API responses via Zod).

---

## 4. Verbose Naming

AI uses overly descriptive names that add noise without clarity.

| Slop | Clean |
|------|-------|
| `budgetItemsArrayForCurrentMonth` | `budgets` |
| `isUserCurrentlyAuthenticated` | `isAuthenticated` |
| `handleBudgetCardClickEvent` | `onCardClick` |
| `filteredAndSortedBudgetList` | `sortedBudgets` |
| `budgetServiceInstance` | `#api` |
| `currentBudgetData` | `budget` |

**Detection:** Variable/method names longer than ~25 characters. Names that include their type (`Array`, `List`, `Map`). Names that repeat context already clear from the class/file name.

**Rule:** Name length proportional to scope size. A local variable in a 5-line method can be short. A public API property deserves more.

---

## 5. Unnecessary Wrapping

AI creates helpers and utilities that are used exactly once.

| Slop | Clean |
|------|-------|
| `formatBudgetAmount(budget)` called once | Inline the formatting |
| `buildQueryParams(filters)` with 2 params | Inline `{ month, year }` |
| `mapBudgetToViewModel(budget)` as standalone function | `computed()` in the store |
| Private method called from one place | Inline it |
| Utility file with 1-2 exports | Keep code where it's used |
| `pipe()` with a single RxJS operator | Just call the method |

**Detection:**
- Private methods called from exactly one place
- Functions/methods with a single caller
- Utility files with fewer than 3 exports
- Pipes with a single operator

**Rule:** Extract when you have 2+ callers OR the code is genuinely complex (>10 lines of non-trivial logic). Simple one-liners never need extraction.

---

## 6. Template Bloat

AI generates templates with excessive structure and redundant wrapper elements.

| Slop | Clean |
|------|-------|
| `<div class="wrapper"><div class="container"><div class="content">...` | Single element with combined classes |
| `@if (items().length > 0)` before `@for` | `@for` with `@empty` block |
| `{{ budget.lines.filter(...).reduce(...) \| currency }}` | `computed()` signal in store |
| `<ng-container>` wrapping a single element | Just the element |
| Repeated `@if` checking the same condition | Single `@if` block |
| Deeply nested `@if` chains (3+ levels) | Flatten with early returns or `@switch` |

**Detection:**
- Nested `<div>`s with single children (wrapper soup)
- Template expressions longer than ~40 characters
- `@if` guarding `@for` on same data (use `@empty`)
- `<ng-container>` around a single child element
- 3+ levels of nested `@if`

---

## 7. Copy-Paste Signatures

AI generates boilerplate patterns that look professional but add zero information.

| Slop | Clean |
|------|-------|
| `/** @class BudgetStore */` | _(TypeScript knows it's a class)_ |
| `/** Constructor */` | _(obvious)_ |
| `/** @param id - The budget ID */` | _(the type says `id: string`)_ |
| `/** @returns void */` | _(useless)_ |
| `/** @see BudgetService */` on an `inject()` | _(navigate via IDE)_ |
| `// #region` / `// #endregion` | _(IDE folding works without them)_ |
| `// eslint-disable-next-line` without explanation | Add WHY or fix the lint issue |

**Detection:** JSDoc that adds zero information beyond TypeScript types. `@param` tags that just repeat the parameter name. `@returns` on void methods. Region comments.

**Rule:** JSDoc is for public library APIs and complex algorithms. Application code should be self-documenting.

---

## 8. Excessive Error Handling

AI wraps everything in try/catch as if every line could throw.

| Slop | Clean |
|------|-------|
| `try/catch` around `signal.update()` | Direct call |
| `try/catch` around `router.navigate()` with no handler | Let it propagate |
| `catch (e) { console.error(e); throw e; }` | Don't catch — same result |
| Error signal for a synchronous operation | Remove the signal |
| Multiple nested try/catch | Single try/catch at the right level |

**Detection:**
- `try/catch` around synchronous, non-throwing code
- `catch` blocks that log and re-throw (catch-log-throw)
- Error signals for operations with no async/failure path
- Multiple nested try/catch in one method

**Rule:** Catch only when you can handle meaningfully. In stores: catch API errors for optimistic rollback. Everything else: let the global error handler deal with it.

---

## 9. Dead Code & Artifacts

AI leaves behind artifacts from iterations or imports things "just in case."

**Detection:**
- Imported types/functions used nowhere
- Methods that nothing calls (search for all references)
- Commented-out code blocks (git has history — delete it)
- `console.log` left from debugging (use Logger service)
- Unused constructor parameters
- Empty `ngOnInit` / `ngOnDestroy` methods

---

## Priority Order (scan in this order)

1. **Over-engineering** — highest complexity impact
2. **Defensive programming theater** — noise that hides real logic
3. **Over-commenting** — visual clutter
4. **Unnecessary wrapping** — indirection for no reason
5. **Template bloat** — DOM complexity
6. **Excessive error handling** — false safety
7. **Verbose naming** — readability
8. **Copy-paste signatures** — noise
9. **Dead code** — usually caught by tooling
