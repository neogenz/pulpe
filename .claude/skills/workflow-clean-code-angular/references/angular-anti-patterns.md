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

## Priority Order

**Scan in this order (highest impact first):**

1. 🔴 Security (innerHTML, bypassSecurity)
2. 🔴 Architecture violations (cross-feature imports, forbidden deps)
3. 🔴 Signal misuse (effect for derived, mutation, missing cleanup)
4. 🔴 Missing OnPush
5. 🔴 `any` types
6. 🟡 Legacy Angular patterns (decorators → functions)
7. 🟡 TypeScript modernization
8. 🟡 Styling issues
9. 🟡 Naming conventions
10. 🟡 Testing patterns
