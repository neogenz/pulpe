---
name: step-01-scan
description: Initialize scope, detect Angular anti-patterns, and catalog issues
prev_step: null
next_step: steps/step-02-apply.md
---

# Step 1: SCAN

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER modify files in this step — scan only
- ✅ ALWAYS parse flags and resolve scope before scanning
- 📋 YOU ARE A SCANNER, not a fixer
- 💬 FOCUS on detection and cataloging issues with file:line
- 🚫 FORBIDDEN to apply any changes or suggest fixes yet

## EXECUTION PROTOCOLS:

- 🎯 Parse flags first, resolve scope, then scan
- 💾 Save results if `{save_mode}` = true
- 📖 Complete full scan before moving to step-02
- 🚫 FORBIDDEN to load step-02 until scan is complete

## CONTEXT BOUNDARIES:

- This is the first step — no previous context
- Flags parsed from user input
- Scope resolved from argument (path, `pending`, `diff main`)
- Results passed to step-02 via memory

## YOUR TASK:

Parse flags, resolve file scope, load Angular project context, and find all anti-patterns in scoped files.

---

## EXECUTION SEQUENCE:

### 1. Parse Flags

```yaml
defaults:
  auto_mode: false       # -a
  economy_mode: false    # -e
  save_mode: false       # -s
  force_arch: false      # --arch
  force_signals: false   # --signals
  force_styling: false   # --styling
  force_testing: false   # --testing
```

Parse input: flags → state variables, remainder → `{task_description}`
Generate `{task_id}` (kebab-case from description)

### 2. Check Resume (-r)

**If `-r {id}` provided:**
→ Find `.claude/output/clean-code-angular/{id}*/`
→ Restore state from `00-context.md`
→ Load appropriate step
→ **STOP**

### 3. Resolve Scope

| Argument | Action |
|----------|--------|
| `feature/budget/` | Glob `frontend/**/feature/budget/**/*.{ts,html,scss}` |
| `core/` | Glob `frontend/**/core/**/*.{ts,html,scss}` |
| `pattern/` | Glob `frontend/**/pattern/**/*.{ts,html,scss}` |
| `layout/` | Glob `frontend/**/layout/**/*.{ts,html,scss}` |
| `pending` | `git diff --name-only HEAD` filtered to `frontend/**/*.{ts,html,scss}` |
| `staged` | `git diff --cached --name-only` filtered to `frontend/**/*.{ts,html,scss}` |
| `diff main` | `git diff main --name-only` filtered to `frontend/**/*.{ts,html,scss}` |
| _(empty)_ | Ask user via AskUserQuestion |

**Filter**: Only `frontend/**/*.{ts,html,scss,spec.ts}` files.

**If 0 files**: Output "No Angular files found in scope" and **STOP**.

Store result in `{scoped_files}`.

### 4. Load Angular Project Context

Call these tools to understand the project:

1. **`mcp__angular-cli__list_projects`** → Get `{workspace_path}` (path to angular.json)
2. **`mcp__angular-cli__get_best_practices`** with `workspacePath` → Load Angular 21 best practices

Store `{workspace_path}` for step-02.

### 5. Create Output (if save_mode)

```bash
mkdir -p .claude/output/clean-code-angular/{task_id}
```

Write `00-context.md` with scope, flags, file list.

### 6. Read Anti-Patterns Checklist

Read `references/angular-anti-patterns.md` — this is the scanning checklist.

### 7. Scan Codebase

**If `{economy_mode}` = true:**
→ Direct tools only (Read, Grep, Glob) — scan files sequentially

**If `{economy_mode}` = false:**
→ Launch parallel agents (single message):

| Agent | Type | Task |
|-------|------|------|
| 1 | explore-codebase | **Architecture scan**: Check dependency direction in `{scoped_files}` — cross-feature imports, forbidden dependencies (feature→feature, ui→core, pattern→feature), circular references |
| 2 | explore-codebase | **Angular anti-pattern scan**: In `{scoped_files}` find: `@Input()`, `@Output()`, `*ngIf`, `*ngFor`, `[ngClass]`, `constructor(private`, `ChangeDetectionStrategy.Default`, legacy DI, missing OnPush |
| 3 | explore-codebase | **Signal & TypeScript scan**: In `{scoped_files}` find: `effect()` for derived state, signal mutation, `any` types, `private` fields (should be `#`), `as Type` casts, missing `takeUntilDestroyed()` |

**Additionally run quick grep on scoped files** (always, even in economy mode):

```bash
# For each $file in {scoped_files}:
grep -n "::ng-deep" "$file"              # Styling violation
grep -n "@Input()" "$file"               # Legacy input
grep -n "@Output()" "$file"              # Legacy output
grep -n "constructor(private" "$file"    # Legacy DI
grep -n ": any" "$file"                  # Any type
grep -n "private \w" "$file"             # Should be #field
grep -n "innerHTML" "$file"              # XSS risk
grep -n "\*ngIf" "$file"                 # Legacy control flow
grep -n "\*ngFor" "$file"                # Legacy control flow
grep -n "\[ngClass\]" "$file"            # Should be [class.name]
grep -n "effect(" "$file"                # Potential misuse
grep -n "console\." "$file"              # Raw console
grep -n "ChangeDetectionStrategy" "$file" # Check if OnPush
```

### 8. Prioritize Files (within scope only)

**Review thoroughly** (if present in scope):
- `core/**/*.service.ts` → Wide impact
- `*.guard.ts`, `*.interceptor.ts` → Security critical
- Files with `effect()` → Reactive bugs
- Files > 200 lines → Complexity smell
- `*.store.ts` → State management patterns

**Quick scan** (if present in scope):
- Pure UI components without `inject()`
- Test files following established patterns

### 9. Catalog Issues

```markdown
## Issues Found

| # | File:Line | Issue | Category | Severity |
|---|-----------|-------|----------|----------|
| 1 | budget.store.ts:45 | `effect()` for derived state | Signals | 🔴 Critical |
| 2 | budget-list.ts:12 | `@Input()` instead of `input()` | Angular | 🟡 Improvement |
| 3 | budget.service.ts:8 | `constructor(private ...)` | DI | 🟡 Improvement |
```

**Severity rules:**
- **🔴 Critical**: Security, bugs, broken functionality, architecture violations, signal misuse
- **🟡 Improvement**: Style, naming, legacy patterns, minor refactoring

**MAX 15 issues** — report top 15 by severity. If more exist, note "N additional issues not shown".

### 10. Confirm

**If `{auto_mode}` = true:**
→ Proceed to step-02

**If `{auto_mode}` = false:**
→ Display issue table, then use AskUserQuestion:

```yaml
questions:
  - header: "Proceed"
    question: "Found {N} issues in {M} files. Proceed to apply fixes?"
    options:
      - label: "Fix All (Recommended)"
        description: "Apply all fixes"
      - label: "Critical Only"
        description: "Only fix critical issues"
      - label: "Review Issues"
        description: "Show detailed analysis first"
      - label: "Cancel"
        description: "Stop without changes"
    multiSelect: false
```

---

## SUCCESS METRICS:

✅ Flags parsed correctly
✅ Scope resolved to concrete file list
✅ Angular project context loaded (list_projects + best_practices)
✅ Anti-patterns checklist read
✅ Issues cataloged with file:line format
✅ Issues prioritized by severity
✅ Architecture violations identified (if any)

## FAILURE MODES:

❌ Modifying files during scan
❌ Scanning files outside the specified scope
❌ Not loading Angular MCP best practices
❌ Not reading the anti-patterns checklist
❌ Missing file:line references in issues

## SCAN PROTOCOLS:

- Always resolve scope FIRST — never scan the entire frontend/
- Report issues with `file.ts:line` format
- Distinguish "missing" from "incorrectly used"
- Check architecture rules for EVERY import in scoped files
- Signal misuse is always 🔴 Critical

---

## NEXT STEP:

After scan complete and user confirms, load `./step-02-apply.md`

<critical>
SCAN ONLY — don't fix anything! Only catalog issues with file:line references.
</critical>
