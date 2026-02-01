---
name: step-02-apply
description: Load Angular 21 documentation, generate recommendations, and apply clean code fixes
prev_step: steps/step-01-scan.md
next_step: steps/step-03-verify.md
---

# Step 2: APPLY

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER apply patterns without reading docs/references first
- ✅ ALWAYS load relevant reference files before making changes
- 📋 YOU ARE AN IMPLEMENTER following documented Angular 21 patterns
- 💬 FOCUS on applying fixes from loaded docs with cited sources
- 🚫 FORBIDDEN to invent patterns not documented in references or Angular MCP

## EXECUTION PROTOCOLS:

- 🎯 Load docs based on issue categories found in step-01
- 💾 Track every fix with file:line and source citation
- 📖 Complete all changes before step-03
- 🚫 FORBIDDEN to modify files outside `{scoped_files}`

## CONTEXT BOUNDARIES:

- From step-01: `{scoped_files}`, `{issues}`, `{workspace_path}`, flags
- Reference files in `references/` folder
- Angular MCP tools for framework-specific docs
- Project rules in `.claude/rules/` (auto-loaded by Claude Code)

## YOUR TASK:

Load Angular 21 documentation, generate prioritized recommendations, and apply clean code fixes with documented sources.

---

## EXECUTION SEQUENCE:

### 1. Load Reference Files

| Condition | Load |
|-----------|------|
| Always | `references/angular-clean-code.md` |
| Always | `references/angular-anti-patterns.md` |
| Architecture issues detected OR `--arch` | `references/angular-architecture.md` |

**CRITICAL: Actually READ the files with Read tool!**

### 2. Load Angular MCP Documentation

Based on issue categories from step-01, query Angular MCP:

| Issue Category | MCP Tool | Query |
|----------------|----------|-------|
| Signal misuse | `mcp__angular-cli__find_examples` | `query: "signal computed linkedSignal"`, `workspacePath` |
| Legacy inputs/outputs | `mcp__angular-cli__find_examples` | `query: "signal input output"`, `workspacePath` |
| Legacy control flow | `mcp__angular-cli__search_documentation` | `query: "control flow @if @for @switch"` |
| Legacy DI | `mcp__angular-cli__find_examples` | `query: "inject function"`, `workspacePath` |
| Store patterns | `mcp__angular-cli__find_examples` | `query: "signal store state management"`, `workspacePath` |
| Material styling | `mcp__angular-cli__search_documentation` | `query: "Material theming design tokens"` |
| OnPush missing | `mcp__angular-cli__find_examples` | `query: "OnPush change detection"`, `workspacePath` |

**Only query for categories that have actual issues.** Don't load docs for clean categories.

### 3. Generate Recommendations

Based on issues + loaded docs, generate prioritized list:

```markdown
## Recommendations

### 🔴 Critical (must fix)

1. **Signal Misuse** — `budget.store.ts:45`
   Replace `effect()` with `computed()` for derived state
   📚 Source: `.claude/rules/frontend/signals.md`

2. **Architecture Violation** — `budget-list.ts:3`
   Cross-feature import from `feature/dashboard/`
   📚 Source: `.claude/rules/00-architecture/angular-architecture.md`

### 🟡 Improvements (should fix)

3. **Legacy Input** — `budget-card.ts:12`
   Replace `@Input()` with `input()`
   📚 Source: angular.dev/guide/components/inputs

4. **Legacy DI** — `budget.service.ts:8`
   Replace `constructor(private ...)` with `inject()`
   📚 Source: angular.dev/guide/di/dependency-injection
```

### 4. Confirm Before Applying

**If `{auto_mode}` = true:**
→ Apply all recommendations

**If `{auto_mode}` = false:**
→ Display recommendations, then use AskUserQuestion:

```yaml
questions:
  - header: "Apply"
    question: "Apply these Angular clean code improvements?"
    options:
      - label: "Apply All (Recommended)"
        description: "Apply all recommendations"
      - label: "Critical Only"
        description: "Only fix critical issues"
      - label: "Review Details"
        description: "Show before/after for each fix"
    multiSelect: false
```

### 5. Apply Changes

**If `{economy_mode}` = true:**
→ Apply sequentially with Edit tool

**If `{economy_mode}` = false AND 4+ files to change:**
→ Use parallel Snipper agents (one per file or group of related files)

**For each fix, apply the following patterns:**

#### Angular Anti-Pattern Fixes

| Anti-Pattern | Fix | Source |
|--------------|-----|--------|
| `@Input()` | `input()` / `input.required()` | angular.dev/guide/components/inputs |
| `@Output()` | `output()` | angular.dev/guide/components/outputs |
| `@Input` + `@Output` (2-way) | `model()` | angular.dev/guide/signals/inputs#model-inputs |
| `*ngIf`, `*ngFor` | `@if`, `@for` (with `track`) | angular.dev/guide/templates/control-flow |
| `[ngClass]` | `[class.name]` binding | Project rule |
| `constructor(private x)` | `readonly #x = inject(X)` | angular.dev/guide/di |
| `ChangeDetectionStrategy.Default` | `ChangeDetectionStrategy.OnPush` | Angular best practices |

#### Signal Pattern Fixes

| Anti-Pattern | Fix | Source |
|--------------|-----|--------|
| `effect()` for derived state | `computed()` | `.claude/rules/frontend/signals.md` |
| `effect()` to sync signals | `linkedSignal()` | angular.dev/guide/signals/linked-signal |
| `signal.mutate(arr => arr.push(x))` | `signal.update(arr => [...arr, x])` | angular.dev/guide/signals |
| Missing cleanup | `takeUntilDestroyed()` | angular.dev/ecosystem/rxjs-interop |
| `BehaviorSubject` | `signal()` + `computed()` | Signal migration |
| Public mutable signal | Private `#signal` + public `computed()` or `.asReadonly()` | Store pattern |

#### TypeScript Fixes

| Anti-Pattern | Fix | Source |
|--------------|-----|--------|
| `private field` | `#field` | Project rule |
| `any` type | `unknown` + type guard | `.claude/rules/shared/typescript.md` |
| `as Type` | Type guard or generic | Same |

#### Architecture Fixes

| Anti-Pattern | Fix | Source |
|--------------|-----|--------|
| Cross-feature import | Move shared code to `pattern/` or `core/` | Architecture doc |
| `ui/` imports `core/` | Remove service dependency, use `input()` | Architecture doc |
| `pattern/` imports `feature/` | Invert dependency | Architecture doc |
| `feature/` imports `feature/` | Extract to `pattern/` or `core/` | Architecture doc |

#### Styling Fixes

| Anti-Pattern | Fix | Source |
|--------------|-----|--------|
| `::ng-deep` | CSS custom properties / `var(--mat-sys-*)` | material.angular.dev/guide/theming |
| `mat-button` (legacy) | `matButton="filled"` | material.angular.dev/components/button |
| `bg-[--var]` | `bg-(--var)` | tailwindcss.com/docs/upgrade-guide |

#### Naming Fixes

| Anti-Pattern | Fix | Source |
|--------------|-----|--------|
| `loading` (boolean) | `isLoading` | `.claude/rules/naming-conventions.md` |
| `item` (array variable) | `items` | Same |

### 6. Track Progress

```markdown
## Changes Applied

| # | File:Line | Change | Source |
|---|-----------|--------|--------|
| 1 | budget.store.ts:45 | `effect()` → `computed()` | signals.md |
| 2 | budget-card.ts:12 | `@Input()` → `input()` | angular.dev |
| 3 | budget.service.ts:8 | `constructor(private)` → `inject()` | angular.dev |
```

### 7. Summary

```markdown
## Apply Summary

- **Files modified**: {N}
- **Critical fixes**: {N}
- **Improvements**: {N}
- **Categories**: Signals ({N}), Angular ({N}), Architecture ({N}), TypeScript ({N}), Styling ({N})
```

**If `{save_mode}` = true:**
→ Write to `.claude/output/clean-code-angular/{task_id}/02-apply.md`

---

## SUCCESS METRICS:

✅ Reference docs loaded and read
✅ Angular MCP queried for relevant categories
✅ Recommendations generated with sources
✅ Changes applied following documented patterns
✅ Every fix has a source citation
✅ Progress tracked with file:line

## FAILURE MODES:

❌ Applying patterns without reading docs
❌ Modifying files outside `{scoped_files}`
❌ Fixes without source citations
❌ Inventing patterns not from reference docs or Angular MCP
❌ Not tracking progress

## APPLY PROTOCOLS:

- Follow patterns from docs exactly — no improvisation
- Every fix must cite its source (URL or rule path)
- Use `#field` not `private field` (project convention)
- Use `inject()` not constructor injection
- Use `input()` / `output()` not decorators
- Use `@if` / `@for` not `*ngIf` / `*ngFor`
- Always add `track` expression to `@for`
- Always use `OnPush` change detection

---

## NEXT STEP:

After changes applied, load `./step-03-verify.md`

<critical>
Follow patterns from LOADED DOCS only! Every fix needs a source citation.
</critical>
