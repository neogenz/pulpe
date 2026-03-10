---
name: workflow-clean-code-angular
description: "Deep Angular 21 clean code audit with parallel specialist agents and senior team lead. Scans architecture, signals, stores, AI slop, ViewModel patterns, and more. Guarantees craftsman-level output. Use whenever the user says 'clean code', 'audit Angular', 'review frontend', 'check quality', 'anti-patterns', wants Angular code reviewed, or needs senior-level code standards enforced — even if they don't say 'clean code' explicitly."
argument-hint: "<scope> [-a auto] [-e economy] [-s save] [--quick] [--deep] [--arch] [--signals] [--styling] [--testing] [--slop] [--vm]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion, mcp__angular-cli__*, mcp__plugin_context7_context7__*
---

<objective>
Guarantee that Angular code in the target scope meets the standard of a senior developer who crafted it by hand — clean, clear, no AI slop, proper architecture, correct signal patterns, and clear ViewModel separation.
</objective>

<philosophy>
This isn't a linter. Linters catch syntax. This skill catches **design decisions** — the kind of issues only a senior engineer spots during code review.

Three things that separate senior-crafted code from AI-generated code:
1. **Nothing unnecessary** — no defensive checks for impossible scenarios, no abstractions with one consumer, no comments that restate the code
2. **Right responsibility in the right place** — stores own data transformations, components coordinate UI, templates just bind
3. **Consistent patterns** — every store follows the same anatomy, every component follows the same structure, no surprise conventions
</philosophy>

<quick_start>

```bash
/clean-code-angular feature/budget/          # Standard audit
/clean-code-angular -a --deep feature/       # Deep audit, auto mode
/clean-code-angular --quick core/            # Quick surface scan
/clean-code-angular --slop --vm feature/     # Focus: AI slop + ViewModel
/clean-code-angular diff main                # Audit changes vs main
/clean-code-angular pending                  # Audit uncommitted changes
```

</quick_start>

<parameters>

| Flag | Description |
|------|-------------|
| `-a` | Auto mode — skip confirmations |
| `-e` | Economy mode — no subagents, direct analysis only |
| `-s` | Save — output reports to `.claude/output/clean-code-angular/` |
| `-r` | Resume — continue from a previous run |
| `--quick` | Surface scan only (grep patterns, no semantic analysis) |
| `--deep` | Full depth: all domains including AI slop + ViewModel + cross-file |
| `--arch` | Force architecture analysis |
| `--signals` | Force signal patterns analysis |
| `--styling` | Force styling analysis |
| `--testing` | Force testing analysis |
| `--slop` | Force AI slop detection |
| `--vm` | Force ViewModel/DataModel analysis |

Default depth (no flag): grep + targeted semantic analysis of key files.
`--deep` enables all specialist domains.

</parameters>

<workflow>
```
SCAN ─────────────────► APPLY ─────────────► VERIFY
  │                       │                     │
  ├─ Parse scope          ├─ Load docs/refs     ├─ pnpm quality
  ├─ Launch specialists   ├─ Apply fixes        ├─ Run tests
  │  (up to 10 agents)    │  (parallel agents)  ├─ Team lead final
  ├─ Team lead review     ├─ Team lead          │  craftsman review
  └─ Consolidated issues  │  coherence check    └─ Commit
                          └─ Track progress
```
</workflow>

<agent_model>

## Specialist Agents

Up to 10 domain-focused agents launched in parallel. Count scales with scope size:

| Scope | Agents | Coverage |
|-------|--------|----------|
| 1-4 files | 3 + lead | Architecture, Angular/Signals, TypeScript/Styling |
| 5-15 files | 5 + lead | + Store patterns, Component design |
| 16-30 files | 7 + lead | + Templates, AI slop |
| 31+ files | 10 + lead | All 10 domains |

### The 10 Domains

| # | Domain | Focus |
|---|--------|-------|
| 1 | Architecture & Dependencies | Layer violations, cross-feature imports, dependency direction |
| 2 | Signals & Reactivity | `effect()` misuse, `computed()` opportunities, `linkedSignal()`, cleanup |
| 3 | Store Patterns | 6-section anatomy, cache-first, optimistic updates, resource usage |
| 4 | Component Design | OnPush, responsibility, size, `input()`/`output()`, `inject()` |
| 5 | Template Quality | Control flow, expression complexity, wrapper bloat, accessibility |
| 6 | TypeScript Quality | `any` types, `#` fields, modern APIs, dead code |
| 7 | Styling | `::ng-deep`, Material M3 tokens, Tailwind v4, `!important` |
| 8 | AI Slop | Over-engineering, unnecessary comments, defensive theater, verbose naming |
| 9 | ViewModel & Data Flow | DataModel vs ViewModel, transformation location, duplicate derivations |
| 10 | Security, Performance & Code Health | XSS, workarounds/hacks, design smells, `@defer`, lazy loading |

### Team Lead

Launched after specialists complete. A senior Angular architect who:
- Merges all specialist reports into one deduplicated list
- Removes false positives by reading the actual code
- Resolves contradictions between specialists
- Adds cross-cutting observations no single specialist caught
- Prioritizes the final issue list
- Verifies fix coherence in step-02
- Does final craftsman review in step-03

</agent_model>

<state_variables>

| Variable | Type | Description |
|----------|------|-------------|
| `{task_description}` | string | Scope to analyze |
| `{task_id}` | string | Kebab-case identifier |
| `{auto_mode}` | boolean | Skip confirmations |
| `{economy_mode}` | boolean | No subagents |
| `{save_mode}` | boolean | Save reports |
| `{depth}` | quick / standard / deep | Analysis depth |
| `{force_*}` | boolean | Per-domain force flags |
| `{scoped_files}` | string[] | Files in scope |
| `{issues}` | array | Consolidated issue list |
| `{workspace_path}` | string | Path to angular.json |
| `{agent_count}` | number | Specialists to launch |

</state_variables>

<reference_files>

| File | When Loaded |
|------|-------------|
| `references/angular-anti-patterns.md` | Always (scanning checklist) |
| `references/angular-clean-code.md` | Always (correct patterns) |
| `references/angular-style-guide.md` | Always (official Angular conventions) |
| `references/angular-architecture.md` | Architecture issues or `--arch` |
| `references/ai-slop-detection.md` | Deep mode, `--slop` |
| `references/viewmodel-patterns.md` | Deep mode, `--vm` |

</reference_files>

<entry_point>

Load `steps/step-01-scan.md`

</entry_point>

<step_files>

| Step | File | Purpose |
|------|------|---------|
| 01 | `step-01-scan.md` | Parse scope, launch specialists, team lead consolidation |
| 02 | `step-02-apply.md` | Load docs, apply fixes, team lead coherence check |
| 03 | `step-03-verify.md` | Quality gate, craftsman review, commit |

</step_files>

<execution_rules>
- Load one step at a time
- Scale agent count to scope size (economy mode = 0 agents, direct tools only)
- Call `mcp__angular-cli__list_projects` and `mcp__angular-cli__get_best_practices` for Angular context
- Use the Grep tool for pattern detection (not bash grep)
- Scope-aware: only touch files within the specified scope
- Every finding: `file:line` reference required
- Every fix: source citation required
- Team lead reviews after scan AND after apply
</execution_rules>

<success_criteria>
After this workflow, the scoped code reads as if a senior Angular developer wrote it by hand:
- Zero architecture violations
- Modern signal patterns throughout
- Stores follow 6-section anatomy with proper ViewModel selectors
- No AI slop — no unnecessary comments, abstractions, or defensive code
- Clean ViewModel separation — stores transform, components bind, templates stay simple
- Consistent patterns across all files in scope
- `pnpm quality` passes
- Tests pass
</success_criteria>
