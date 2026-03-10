---
name: step-01-scan
description: Parse scope, launch specialist agents, team lead consolidation
prev_step: null
next_step: steps/step-02-apply.md
---

# Step 1: SCAN

Build a complete picture of every issue in the scoped code before touching anything. Understanding the full landscape first leads to better, more coherent fixes. Fixing during scan means you lose the big picture and miss higher-priority issues downstream.

---

## 1. Parse Flags

```yaml
defaults:
  auto_mode: false       # -a
  economy_mode: false    # -e
  save_mode: false       # -s
  depth: standard        # --quick → quick, --deep → deep
  force_arch: false      # --arch
  force_signals: false   # --signals
  force_styling: false   # --styling
  force_testing: false   # --testing
  force_slop: false      # --slop
  force_vm: false        # --vm
```

Parse input: flags → state variables, remainder → `{task_description}`.
Generate `{task_id}` (kebab-case from description).

`--deep` enables all force flags. `--quick` disables semantic analysis.

## 2. Check Resume (-r)

If `-r {id}`: find `.claude/output/clean-code-angular/{id}*/`, restore state from `00-context.md`, load the appropriate step, stop.

## 3. Resolve Scope

| Argument | Action |
|----------|--------|
| `feature/budget/` | Glob `frontend/**/feature/budget/**/*.{ts,html,scss}` |
| `core/` | Glob `frontend/**/core/**/*.{ts,html,scss}` |
| `pattern/` | Glob `frontend/**/pattern/**/*.{ts,html,scss}` |
| `layout/` | Glob `frontend/**/layout/**/*.{ts,html,scss}` |
| `pending` | `git diff --name-only HEAD` filtered to `frontend/**/*.{ts,html,scss}` |
| `staged` | `git diff --cached --name-only` filtered |
| `diff main` | `git diff main --name-only` filtered |
| _(empty)_ | Ask user via AskUserQuestion |

Only `frontend/**/*.{ts,html,scss,spec.ts}` files. If 0 files: output "No Angular files found in scope" and stop.

Store as `{scoped_files}`. Count determines `{agent_count}`:

| Files | Agents |
|-------|--------|
| 1-4 | 3 |
| 5-15 | 5 |
| 16-30 | 7 |
| 31+ | 10 |

## 4. Load Angular Project Context

1. `mcp__angular-cli__list_projects` → get `{workspace_path}`
2. `mcp__angular-cli__get_best_practices` with `workspacePath`

If either MCP call fails (server down, misconfigured), continue without it. The reference files contain enough context to run the scan — MCP data is supplementary, not blocking.

## 5. Create Output (if save_mode)

```bash
mkdir -p .claude/output/clean-code-angular/{task_id}
```

Write `00-context.md` with scope, flags, file list, depth.

## 6. Load Reference Files

Read with the Read tool:
- `references/angular-anti-patterns.md` — always
- `references/angular-style-guide.md` — always
- `references/ai-slop-detection.md` — if deep mode or `--slop`
- `references/viewmodel-patterns.md` — if deep mode or `--vm`

---

## 7. Scan

### Quick Mode (`--quick`)

Grep-only scan using patterns from `references/angular-anti-patterns.md`. Use the **Grep tool** (not bash grep) for each pattern. No file reading, no semantic analysis. Fast surface check.

Key Grep patterns to run on `{scoped_files}`:
- `@Input(` — legacy input
- `@Output(` — legacy output
- `constructor(private` — legacy DI
- `::ng-deep` — styling violation
- `\\*ngIf` / `\\*ngFor` — legacy control flow
- `effect(` — potential signal misuse
- `: any` — untyped
- `private \\w` — should be `#field`
- `innerHTML` — XSS risk
- `console\\.` — raw console
- `ChangeDetectionStrategy` — check if OnPush
- `setTimeout` — potential change detection workaround
- `detectChanges` — manual CD trigger (signals should handle this)
- `@ts-ignore` / `@ts-expect-error` — suppressed type errors
- `as any` — type escape hatch
- `eslint-disable` — suppressed lint rules
- `document\\.querySelector` — direct DOM access (use `viewChild()`)
- `NgZone` / `zone\\.run` — unnecessary in zoneless Angular
- `catch.*\\{\\s*\\}` — empty catch block (swallowed error)
- `catch.*: any` — untyped error catch

### Economy Mode (`-e`)

Use Grep tool for pattern detection, then Read key files (stores, services, main components) for targeted semantic analysis. No subagents.

### Standard / Deep Mode

Launch specialist agents **in a single message** (all at once). Each agent is a `code-reviewer` type with:
- The `{scoped_files}` list
- Its domain focus and detection criteria
- Instruction to return findings as: `file:line | issue description | category | severity`
- The relevant reference file(s) to load

**Launch these agents based on `{agent_count}`:**

---

**Agent 1 — Architecture & Dependencies** _(always)_

> Analyze imports in `{scoped_files}`. For each import, determine source layer and target layer from the path (`core/`, `feature/`, `pattern/`, `ui/`, `layout/`, `styles/`). Flag any forbidden dependency per the architecture reference. Check for cross-feature imports (`feature/x` importing from `feature/y`). Report: `file:line | import path | from_layer → to_layer`.
> Load: `references/angular-architecture.md`

---

**Agent 2 — Signals & Reactivity** _(always)_

> Read `.ts` files in scope. Find: `effect()` used for derived state (should be `computed()`), `effect()` syncing signals (should be `linkedSignal()`), signal mutation (`.mutate`, in-place `.push`/`.splice`), `subscribe()` without `takeUntilDestroyed()`, `BehaviorSubject` that should be `signal()`, `toSignal()` without `initialValue`. Don't just grep — read the `effect()` body and determine if a better primitive exists.
>
> **RxJS nuance**: RxJS is valid and expected for event streams, WebSocket connections, complex async orchestration (race conditions, retries, debounce chains), and router/form `valueChanges`. Only flag RxJS when a signal primitive is clearly better — specifically: `BehaviorSubject` used as local component state (→ `signal()`), `combineLatest` feeding a template binding (→ `computed()`), `Subject.next()` used to sync two values (→ `linkedSignal()`). If the Observable handles genuinely streamy behavior, leave it alone.
> Load: `references/angular-anti-patterns.md` section 2

---

**Agent 3 — Store Patterns** _(5+ agents)_

> Read all `*.store.ts` and `*-store.ts` files in scope. Check against the 6-section anatomy: Dependencies → State → Resource → Selectors → Mutations → Private utils. Verify: cache-first loader pattern, optimistic update pattern, temp ID handling (real ID before cascade), `@Injectable()` vs `providedIn: 'root'` scoping, `resource()` / `rxResource()` usage.
>
> **Error handling in stores** — this is where most async operations live:
> - Every `async` mutation method must have `try/catch` with state revert on error
> - `catch (error: unknown)` — never `catch (e: any)` or empty `catch {}`
> - Error narrowing via `isApiError()` or type guards — not raw `error.message`
> - `firstValueFrom()` calls must be inside `try/catch`
> - `resource()` / `httpResource()` consumers must check `.error()` or `.status()` in templates
> - Zod `.parse()` in `httpResource({ parse })` is correct — but `.parse()` in other contexts needs error handling or `.safeParse()`
> Load: `.claude/rules/03-frameworks-and-libraries/angular-store-pattern.md`, `references/angular-anti-patterns.md` section 18

---

**Agent 4 — Component Design** _(5+ agents)_

> Read component files in scope. Check:
> - `ChangeDetectionStrategy.OnPush` present
> - File < 300 lines, functions < 30 lines
> - Single responsibility (component coordinates UI — doesn't transform data). God component smell: ≥ 6 `inject()` calls in one class signals too many responsibilities
> - `inject()` vs constructor DI, `input()` vs `@Input()`, `output()` vs `@Output()`
> - `host: {}` vs `@HostBinding/@HostListener`, `viewChild()` vs `@ViewChild()`
>
> **Angular style guide checks** (from angular.dev/style-guide):
> - `protected` on members only accessed from template (not `public`)
> - `readonly` on `input()`, `output()`, `model()`, `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`
> - Event handlers named for action, not event (`saveData()` not `handleClick()`, `onClick()`)
> - Member order: injected deps → inputs → outputs → queries → computed → methods
> - Lifecycle hooks implement interface (`implements OnInit`, not just `ngOnInit()` method)
> - Empty lifecycle hooks = dead code, flag for removal
> Load: `references/angular-clean-code.md` section 1, `references/angular-style-guide.md`

---

**Agent 5 — Template Quality** _(5+ agents)_

> Read `.html` files and inline templates in scope. Check: `@if`/`@for`/`@switch` vs legacy directives, every `@for` has `track`, `@empty` blocks for lists, template expressions > 40 chars (should be `computed()`), unnecessary `<ng-container>` wrappers, nested `<div>` bloat (wrapper soup), `[ngClass]` → `[class.x]`, `[ngStyle]` → `[style.x]` or Tailwind.
> Load: `references/angular-clean-code.md` section 4

---

**Agent 6 — TypeScript Quality** _(7+ agents)_

> Check `.ts` files:
> - `any` types → `unknown` + type guard
> - `as Type` casts → type guard or generic
> - `private` → `#` native private
> - `JSON.parse(JSON.stringify())` → `structuredClone()`
> - `.sort()`/`.reverse()` → `.toSorted()`/`.toReversed()`
> - Manual `reduce` for grouping → `Object.groupBy()`
> - Commented-out code → delete
> - Magic numbers → named constants
> - Dead imports, unused methods
>
> Load: `references/angular-anti-patterns.md` section 6

---

**Agent 7 — Styling** _(7+ agents)_

> Read `.scss` files and inline styles. Check: `::ng-deep` → CSS custom properties, `!important` → specificity fix, `bg-[--var]` → `bg-(--var)` (Tailwind v4), `mat-button` → `matButton="filled"`, inline `style=""` → Tailwind/component styles, missing M3 token usage `var(--mat-sys-*)`.
> Load: `references/angular-anti-patterns.md` section 7

---

**Agent 8 — AI Slop Detection** _(deep mode or `--slop`, 7+ agents)_

> Read every file in scope looking for AI-generated code smells. Focus on: comments that restate code, over-engineered abstractions with a single consumer, defensive null checks on DI-injected or type-guaranteed values, verbose variable names (>25 chars), single-use helper functions, `try/catch` around non-throwing code, JSDoc that adds nothing beyond TypeScript types, unnecessary intermediate variables, wrapper `<div>` soup in templates.
> Load: `references/ai-slop-detection.md`

---

**Agent 9 — ViewModel & Data Flow** _(deep mode or `--vm`, 10 agents)_

> Trace data flow: API → Store → Component → Template. Check: raw API types in templates (should go through store `computed()`), transformation logic in components that belongs in store, store returning formatted strings (formatting is view concern — use pipes), duplicate `computed()` across components (should be shared store selector), god ViewModel objects (one big `computed()` returning everything), `ngOnInit` manually constructing ViewModels (breaks reactivity).
> Load: `references/viewmodel-patterns.md`

---

**Agent 10 — Security, Performance & Code Health** _(10 agents)_

> **Security & Performance**: `innerHTML` binding (XSS), `bypassSecurityTrust*`, `console.log` (use Logger), missing `@defer` opportunities for heavy below-fold components, eager imports from lazy-loaded features, `@for` without meaningful `track` expression.
>
> **Workaround / hack detection** — framework bypasses that indicate deeper issues:
> - `setTimeout(0)` — working around change detection
> - `detectChanges()` / `markForCheck()` in OnPush components — should not be needed with signals
> - `@ts-ignore` / `@ts-expect-error` — hiding type errors
> - `as any` — type escape hatch
> - `eslint-disable` without justification comment
> - `document.querySelector()` — use `viewChild()` + `ElementRef`
> - `window.location` for navigation — use `Router`
> - `zone.run()` / `NgZone` — not needed in zoneless Angular
>
> **Design smell detection**:
> - Feature envy: method that mostly accesses another class's data — logic belongs elsewhere
> - Primitive obsession: raw `string` IDs, amounts, dates where branded types would prevent misuse
> - Inappropriate intimacy: component reaching into store's private state or deeply nested signal properties
>
> Load: `references/angular-anti-patterns.md` sections 8, 15, 16

---

## 8. Team Lead Consolidation

After all specialists complete, launch a **team lead agent** (`code-reviewer` type):

> You are a senior Angular architect. You have specialist reports from {N} agents analyzing `{scoped_files}`.
>
> Your job:
> 1. **Merge** findings into one deduplicated list — remove exact duplicates across agents
> 2. **Validate** — if a finding looks questionable, read the actual file to confirm or dismiss it
> 3. **Resolve contradictions** — if two specialists disagree on the same code, investigate and decide
> 4. **Cross-cutting observations** — look for issues no single specialist caught: inconsistent patterns across files, missing shared abstractions where 2+ files do the same transformation, naming inconsistencies within the scope
> 5. **Prioritize** — sort by impact: Critical (bugs, security, architecture) → Important (patterns, signals) → Minor (naming, style)
> 6. **Cap at 30** — report top 30 issues. If more exist, note the total.
>
> Output a markdown table:
> `| # | File:Line | Issue | Category | Severity | Source |`
>
> Severity: Critical / Important / Minor
> Every issue must be concrete and actionable — not vague ("could be improved").

## 9. Present Results

Display the team lead's consolidated issue table.

**If `{auto_mode}`:** proceed to step-02 immediately.

**Otherwise:** ask the user:
- **Fix All** — apply all fixes
- **Critical Only** — fix Critical + Important, skip Minor
- **Review Details** — show detailed analysis per issue before deciding
- **Cancel** — stop without changes

**If `{save_mode}`:** write report to `01-scan.md`.

---

## Next Step

After scan complete and user confirms → load `steps/step-02-apply.md`
