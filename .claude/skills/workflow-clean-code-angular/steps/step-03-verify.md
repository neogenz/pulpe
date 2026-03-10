---
name: step-03-verify
description: Quality gate, team lead craftsman review, commit
prev_step: steps/step-02-apply.md
next_step: null
---

# Step 3: VERIFY

The final gate. Code must pass automated checks AND the team lead's craftsman review. If either fails, loop until both pass.

---

## 1. Run Quality Check

```bash
pnpm quality
```

This runs type-check + lint + format for all packages.

If errors:
1. Read the error output
2. Fix the issue (likely in files just modified)
3. Re-run `pnpm quality`
4. Loop until passes — max 5 attempts

If still failing after 5 attempts: stop and ask the user. Something structural may need human judgment.

## 2. Run Tests

If test files exist for modified files:

```bash
cd frontend && pnpm test -- path/to/file.spec.ts
```

If tests fail:
1. Read the error
2. Fix test or implementation
3. Re-run — max 3 attempts

If no tests exist for the scope: note it in the summary. Don't create tests — that's out of scope for this workflow.

## 3. Team Lead Craftsman Review

This is the gate that ensures the code reads like a senior wrote it. Launch the team lead (`code-reviewer` type):

> You are a senior Angular developer doing a final quality review. The code has been cleaned up and passes automated checks. Now read every modified file one more time.
>
> For each file, evaluate these five dimensions:
>
> **1. Craftsmanship** — Does it read like a senior wrote it by hand? Is the code clear, minimal, and intentional? Would you be proud to ship this?
>
> **2. AI Slop** — Any remaining signs of AI generation? Unnecessary comments restating code, over-engineered abstractions, defensive checks for impossible scenarios, verbose names, single-use wrappers.
>
> **3. ViewModel Separation** — Do stores own data transformations via `computed()` selectors? Do components just bind to store signals? Are templates free of complex expressions (> 40 chars)? No duplicate derivations across files?
>
> **4. Pattern Consistency** — Does every store follow the 6-section anatomy? Every component use `OnPush`, `input()`, `inject()`? Same naming conventions throughout? No mixed old/new patterns in the same scope?
>
> **5. Dead Code** — Unused imports, unreachable branches, orphaned methods, commented-out code, empty lifecycle hooks.
>
> Rate each file: **CLEAN** / **MINOR ISSUES** / **NEEDS REWORK**
>
> For any file not rated CLEAN: describe exactly what's wrong and what to fix.

If the team lead identifies issues:
1. Fix them
2. Re-run `pnpm quality` if code changed
3. Re-run the craftsman review — max 2 review cycles

The goal: every file in scope rated **CLEAN**.

## 4. Generate Final Summary

```markdown
## Angular Clean Code Audit Complete

### Verification
| Check | Status |
|-------|--------|
| TypeScript | Pass / Fail |
| ESLint | Pass / Fail |
| Format | Pass / Fail |
| Tests | Pass / No tests |
| Craftsman Review | All CLEAN / See notes |

### Changes Applied
| # | File:Line | Change | Category | Source |
|---|-----------|--------|----------|--------|

### Summary by Category
| Category | Critical | Important | Minor | Total |
|----------|----------|-----------|-------|-------|
| Architecture | | | | |
| Signals | | | | |
| Store Patterns | | | | |
| Components | | | | |
| Templates | | | | |
| TypeScript | | | | |
| Styling | | | | |
| AI Slop | | | | |
| ViewModel | | | | |
| Security | | | | |
| **Total** | | | | |

### Files Modified: {N}
### Craftsman Rating: ALL CLEAN / ATTENTION NEEDED
```

**If `{save_mode}`:** write to `03-verify.md`.

## 5. Commit

**If `{auto_mode}`:** commit automatically.

**Otherwise:** ask:
- **Commit** — commit with descriptive message
- **Done** — finish without committing
- **Review Changes** — show `git diff` before deciding

Commit format:
```bash
git add {specific_files}
git commit -m "$(cat <<'EOF'
refactor({scope}): apply Angular 21 clean code audit

- {main changes grouped by category}
EOF
)"
```

Use specific file adds (not `git add -A`). Use the actual scope name in the conventional commit prefix.

---

## Workflow Complete
