---
name: workflow-clean-code-angular
description: "Systematic Angular 21 clean code workflow — scans, fixes anti-patterns, enforces architecture rules, and verifies. Uses parallel agents, Angular MCP tools, and project-specific rules."
argument-hint: "<scope> [-a auto] [-e economy] [-s save] [--arch] [--signals] [--styling] [--testing]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion, mcp__angular-cli__*, mcp__plugin_context7_context7__*
---

<objective>
Fast, systematic clean code improvements for Angular 21+ projects. Enforces Pulpe architecture rules,
modern signal patterns, Material 3 styling, and Angular best practices with documented sources and concrete fixes.
</objective>

<quick_start>

**Basic usage (analyze and fix a feature):**
```bash
/clean-code-angular feature/budget/
```

**Auto mode (skip confirmations):**
```bash
/clean-code-angular -a feature/dashboard/
```

**With save (output to `.claude/output/clean-code-angular/`):**
```bash
/clean-code-angular -s -a core/
```

**Architecture focus:**
```bash
/clean-code-angular --arch feature/
```

**What it does:**
1. Scans Angular files for anti-patterns (signals, DI, templates, architecture)
2. Loads Angular 21 best practices via MCP + project rules
3. Applies clean code improvements with concrete fixes
4. Verifies with `pnpm quality` and tests
5. Commits changes
</quick_start>

<parameters>

| Flag | Description |
|------|-------------|
| `-a` | Auto mode: skip confirmations |
| `-e` | Economy mode: no subagents, direct tools only |
| `-s` | Save mode: output to `.claude/output/clean-code-angular/` |
| `-r` | Resume mode: continue from previous task |
| `--arch` | Force architecture analysis (dependency direction, cross-feature imports) |
| `--signals` | Force signal patterns analysis (effect misuse, computed, linkedSignal) |
| `--styling` | Force styling analysis (::ng-deep, legacy Material, Tailwind v4) |
| `--testing` | Force testing analysis (AAA, naming, test coverage) |

<examples>
```bash
/clean-code-angular feature/budget/          # Basic - scan a feature
/clean-code-angular -a feature/dashboard/    # Auto mode
/clean-code-angular -e -a core/              # Economy + auto
/clean-code-angular -s pattern/              # Save outputs
/clean-code-angular -r budget-feature        # Resume
/clean-code-angular --arch --signals layout/ # Force specific checks
/clean-code-angular pending                  # Scan pending git changes
/clean-code-angular diff main               # Scan diff against main
```
</examples>

</parameters>

<workflow>
```
SCAN ──────────► APPLY ──────────► VERIFY
  │                │                  │
  │                │                  └─ pnpm quality, test, commit
  │                └─ Load Angular MCP docs, apply fixes
  └─ Parse scope, detect anti-patterns, check architecture
```
</workflow>

<state_variables>

| Variable | Type | Description |
|----------|------|-------------|
| `{task_description}` | string | Scope to analyze (path or git scope) |
| `{task_id}` | string | Kebab-case identifier |
| `{auto_mode}` | boolean | Skip confirmations |
| `{economy_mode}` | boolean | No subagents |
| `{save_mode}` | boolean | Save outputs |
| `{force_arch}` | boolean | Force architecture check |
| `{force_signals}` | boolean | Force signals check |
| `{force_styling}` | boolean | Force styling check |
| `{force_testing}` | boolean | Force testing check |
| `{scoped_files}` | string[] | Files in scope |
| `{issues}` | array | Issues found with file:line |
| `{workspace_path}` | string | Path to angular.json |

</state_variables>

<reference_files>

| File | When Loaded |
|------|-------------|
| `references/angular-clean-code.md` | Always |
| `references/angular-architecture.md` | Architecture issues detected / `--arch` |
| `references/angular-anti-patterns.md` | Always (checklist for scanning) |

</reference_files>

<entry_point>

Load `steps/step-01-scan.md`

</entry_point>

<step_files>

| Step | File | Purpose |
|------|------|---------|
| 01 | `step-01-scan.md` | Init + scope + scan for anti-patterns |
| 02 | `step-02-apply.md` | Load docs + recommend + apply fixes |
| 03 | `step-03-verify.md` | Quality check + test + commit |

</step_files>

<execution_rules>
- Load one step at a time
- Use parallel agents in step-01 (unless economy mode)
- Always call `mcp__angular-cli__get_best_practices` with workspace path
- Always call `mcp__angular-cli__list_projects` to get workspace context
- Follow patterns from reference files and Angular MCP docs
- Run `pnpm quality` before completing
- Scope-aware: only touch files within the specified scope
</execution_rules>

<success_criteria>
- Scope correctly parsed (path, pending, diff)
- Angular anti-patterns identified with file:line references
- Architecture rules enforced (dependency direction, feature isolation)
- Signal patterns modernized (computed over effect, linkedSignal, etc.)
- Fixes applied with documented sources
- `pnpm quality` passes
- Tests pass (if tests exist for scope)
- Changes committed with clear message
</success_criteria>
