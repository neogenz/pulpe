---
name: step-02-apply
description: Load documentation, apply fixes with parallel agents, team lead coherence check
prev_step: steps/step-01-scan.md
next_step: steps/step-03-verify.md
---

# Step 2: APPLY

Apply fixes from the consolidated issue list. Every change follows documented patterns and cites its source. After all fixes, the team lead verifies cross-file coherence.

Don't invent patterns — follow the loaded references. If no reference covers an issue, flag it rather than improvising.

---

## 1. Load Reference Files

Based on issue categories found in step-01:

| Condition | Load |
|-----------|------|
| Always | `references/angular-clean-code.md` |
| Always | `references/angular-anti-patterns.md` |
| Always | `references/angular-style-guide.md` |
| Architecture issues | `references/angular-architecture.md` |
| AI Slop issues | `references/ai-slop-detection.md` |
| ViewModel issues | `references/viewmodel-patterns.md` |
| Store issues | `.claude/rules/03-frameworks-and-libraries/angular-store-pattern.md` |

Read each relevant file with the Read tool.

## 2. Load Angular MCP Documentation

Query Angular MCP **only for categories with actual issues** — don't load docs for clean categories:

| Issue Category | MCP Tool | Query |
|----------------|----------|-------|
| Signal misuse | `find_examples` | `"signal computed linkedSignal"` |
| Legacy inputs/outputs | `find_examples` | `"signal input output"` |
| Legacy control flow | `search_documentation` | `"control flow @if @for @switch"` |
| Legacy DI | `find_examples` | `"inject function"` |
| Store patterns | `find_examples` | `"signal store state management"` |
| Material styling | `search_documentation` | `"Material theming design tokens"` |

## 3. Generate Fix Plan

For each issue from the consolidated list, generate a concrete recommendation:

```markdown
### #{N} — {Issue Title}
**File**: `file.ts:line`
**Category**: {Category} | **Severity**: {level}
**Current**: what's wrong (brief)
**Fix**: what to change (concrete)
**Source**: URL or rule file path
```

Group recommendations by file to minimize context switching.

## 4. Confirm

**If `{auto_mode}`:** proceed to apply.

**Otherwise:** display the fix plan and ask:
- **Apply All** — apply everything
- **Critical Only** — skip Minor severity items
- **Review Before/After** — show the planned diff for each fix before applying

## 5. Apply Changes

### Economy Mode (`-e`)

Apply sequentially with the Edit tool. One file at a time.

### Standard / Deep Mode (4+ files to change)

Launch parallel `Snipper` agents — one per file or group of related files.

Each agent gets:
- The file(s) to modify
- The specific fixes to apply (from the plan, with exact line numbers)
- The reference patterns to follow
- This constraint: **"Apply ONLY the listed fixes. Don't improve adjacent code, add comments, or refactor anything not in the plan."**
- After applying fixes, run `npx tsc --noEmit --pretty {file}` on the modified file(s) to catch type errors early. If it fails, fix immediately before returning — don't pass broken code to the coherence check.

Group related fixes: if multiple issues affect the same file, one agent handles all of them.

### Fix Application Rules

Follow the patterns from loaded references exactly:

- **Angular patterns**: `references/angular-clean-code.md` — `input()`, `output()`, `@if`/`@for`, `inject()`, `OnPush`, `host: {}`
- **Style guide**: `references/angular-style-guide.md` — `protected` template members, `readonly` signals, handler naming, member order, lifecycle interfaces
- **Architecture**: `references/angular-architecture.md` — move shared code to correct layer, fix import direction
- **Store anatomy**: `.claude/rules/03-frameworks-and-libraries/angular-store-pattern.md` — 6-section structure, cache-first, resource usage
- **AI Slop removal**: `references/ai-slop-detection.md` — delete unnecessary comments, inline single-use helpers, remove defensive theater
- **ViewModel fixes**: `references/viewmodel-patterns.md` — move transformations to store `computed()`, remove template expressions

Every change must trace to a documented pattern and cite its source.

## 6. Team Lead Coherence Check

After all fixes are applied, launch the team lead agent (`code-reviewer` type):

> You are a senior Angular architect reviewing changes just applied across multiple files.
> Read every modified file.
>
> Check for:
> 1. **Cross-file consistency** — do all modified files follow the same patterns? Same DI style, same signal patterns, same naming conventions?
> 2. **Broken imports** — did any refactoring break import paths? Did moving code to `pattern/` update all consumers?
> 3. **Incomplete migrations** — if `@Input()` → `input()` in a component, did callers update their templates too?
> 4. **ViewModel coherence** — if store selectors changed, do component template bindings still match?
> 5. **Side effects** — did any fix break a different concern? Did removing a "defensive" null check actually remove a needed guard?
> 6. **Remaining slop** — after fixes, is there any leftover AI slop the specialists missed?
>
> If issues found: list them with `file:line` for immediate fix.
> If everything is coherent: confirm "Changes are coherent."

Fix any issues the team lead identifies, then re-check if the fix was non-trivial.

## 7. Track Progress

```markdown
## Changes Applied

| # | File:Line | Change | Category | Source |
|---|-----------|--------|----------|--------|
| 1 | ... | ... | ... | ... |

### Summary
- **Files modified**: {N}
- **Critical fixes**: {N}
- **Important fixes**: {N}
- **Minor fixes**: {N}
- **Coherence check**: Passed / {issues fixed}
```

**If `{save_mode}`:** write to `02-apply.md`.

---

## Next Step

After changes applied and coherence verified → load `steps/step-03-verify.md`
