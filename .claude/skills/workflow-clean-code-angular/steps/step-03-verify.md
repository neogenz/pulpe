---
name: step-03-verify
description: Verify quality passes and summarize all changes
prev_step: steps/step-02-apply.md
next_step: null
---

# Step 3: VERIFY

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER complete with failing `pnpm quality`
- ✅ ALWAYS run quality check before marking done
- 📋 YOU ARE A VALIDATOR ensuring nothing is broken
- 💬 FOCUS on verification and summary
- 🚫 FORBIDDEN to skip any check

## EXECUTION PROTOCOLS:

- 🎯 Run all verification commands
- 💾 Save summary if `{save_mode}` = true
- 📖 Fix any errors before completing
- 🚫 FORBIDDEN to mark complete if quality fails

## CONTEXT BOUNDARIES:

- From step-02: changes applied, files modified, progress table
- Build/lint/test commands from CLAUDE.md
- Package manager: pnpm (Pulpe convention)

## YOUR TASK:

Run quality checks, fix any errors introduced, and provide a final summary with all changes and sources.

---

## EXECUTION SEQUENCE:

### 1. Run Quality Check

```bash
pnpm quality
```

This runs type-check + lint + format for all packages.

**If errors:**
1. Read the error output
2. Fix the issue (likely in files we just modified)
3. Re-run `pnpm quality`
4. **Loop until passes** (max 5 attempts)

### 2. Run Tests (for scoped files)

If test files exist for the modified scope:

```bash
cd frontend && pnpm test -- path/to/file.spec.ts
```

**If tests fail:**
1. Read error
2. Fix test or implementation
3. Re-run
4. **Loop until passes** (max 3 attempts)

**If no tests exist:** Note in summary, don't create tests (out of scope for clean-code).

### 3. Generate Final Summary

```markdown
## Angular Clean Code Complete

### Verification
| Check | Status |
|-------|--------|
| TypeScript | ✅ |
| ESLint | ✅ |
| Format | ✅ |
| Tests | ✅ / ⚠️ No tests |

### Changes Applied
| # | File:Line | Change | Category | Source |
|---|-----------|--------|----------|--------|
| 1 | budget.store.ts:45 | `effect()` → `computed()` | Signals | signals.md |
| 2 | budget-card.ts:12 | `@Input()` → `input()` | Angular | angular.dev |
| 3 | budget.service.ts:8 | constructor DI → `inject()` | DI | angular.dev |

### Summary
| Category | Critical | Improvements | Total |
|----------|----------|--------------|-------|
| Signals | 1 | 0 | 1 |
| Angular | 0 | 2 | 2 |
| Architecture | 1 | 0 | 1 |
| TypeScript | 0 | 1 | 1 |
| Styling | 0 | 1 | 1 |
| **Total** | **2** | **4** | **6** |

### Files Modified: {N}
```

**If `{save_mode}` = true:**
→ Write to `.claude/output/clean-code-angular/{task_id}/03-verify.md`

### 4. Offer Commit

**If `{auto_mode}` = true:**
→ Create commit automatically

**If `{auto_mode}` = false:**
→ Use AskUserQuestion:

```yaml
questions:
  - header: "Complete"
    question: "Angular clean code complete. What next?"
    options:
      - label: "Commit (Recommended)"
        description: "Commit all changes with descriptive message"
      - label: "Done"
        description: "Finish without committing"
      - label: "Review Changes"
        description: "Show git diff before committing"
    multiSelect: false
```

**If commit:**
```bash
git add {modified_files}
git commit -m "$(cat <<'EOF'
refactor({scope}): apply Angular 21 clean code improvements

- {list of main changes}
EOF
)"
```

Use specific file adds (not `git add -A`).
Use the actual scope name (e.g., `refactor(budget): ...`).

---

## SUCCESS METRICS:

✅ `pnpm quality` passes (type-check + lint + format)
✅ Tests pass (if they exist)
✅ Final summary with all changes and sources
✅ Commit created (if requested)

## FAILURE MODES:

❌ Completing with failing quality check
❌ Skipping verification
❌ Summary without source citations
❌ Using `git add -A` instead of specific files

## VERIFY PROTOCOLS:

- Always run `pnpm quality` (project convention)
- Fix errors in a loop, max 5 attempts
- Every change in summary must have a source
- Commit message follows conventional commits: `refactor({scope}): ...`

---

## WORKFLOW COMPLETE

<critical>
NEVER complete if `pnpm quality` fails!
</critical>
