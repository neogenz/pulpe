---
status: done
---

# Instruction: remove-work-artifacts-and-consolidate-docs

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .gitignore                                                    ✏️ ignore local AIDD execution tasks
├── .claude
│   ├── commands/impl-savings.md                                  ❌ delete local orchestration command
│   └── launch.json                                               ✅ retain required development launch config
├── aidd_docs/tasks/2026_07
│   ├── 2026_07_10_savings_goals_pul_12_pul_8/                   ❌ delete generated plan/review files
│   ├── 2026_07_11_ios_savings_goals_audit/                      ❌ delete generated audit files
│   ├── 2026_07_11_savings_goals_ios_completion/                 ❌ delete generated phase files
│   ├── 2026_07_11_simulator_redistribution_control_sync/        ❌ delete generated plan/review/spec files
│   └── 2026_07_12_savings_goals_ios_intro/                      ❌ delete generated phase files
└── docs
    ├── INDEX.md                                                  ✏️ link the retained savings source of truth and diagram
    ├── SAVINGS.md                                                ✏️ absorb the unique durable simulator rules
    ├── SAVINGS_PLAN.md                                           ❌ delete mixed implementation-plan document
    ├── SAVINGS_PROGRESS.md                                       ❌ delete agent handoff journal
    └── diagrams
        ├── likec4.config.json                                    ✅ retain required diagram config
        └── savings-goals.c4                                      ✏️ align status and implemented/proposed tags with reality
```

## Tasks to do

### `1)` Remove local-generation artifacts from the PR

> Delete only files added by `pul-12-epic`; preserve the pre-existing `aidd_docs/tasks` history on `preview`.

1. Move `.claude/commands/impl-savings.md` and the five PR-added AIDD task directories to Trash.
2. Keep `.claude/launch.json` unchanged as required development configuration.
3. Add `aidd_docs/tasks/` to `.gitignore` as local AIDD execution output; do not remove the historical task files already tracked on `preview`.
4. Move `docs/SAVINGS_PROGRESS.md` to Trash; it explicitly exists for `/impl-savings` handoffs and contains stale branch, “NEXT”, and uncommitted-state entries.
5. Confirm no retained source or documentation references `/impl-savings` or `SAVINGS_PROGRESS.md`.

### `2)` Keep one maintained savings documentation path

> Preserve business and technical intent without shipping completed implementation tracking.

1. Extract from `docs/SAVINGS_PLAN.md` only simulator behavior and invariants not already covered by `docs/SAVINGS.md`, schemas, tests, migrations, or nearby code comments.
2. Add that minimal durable content to `docs/SAVINGS.md`; replace source references to `SAVINGS_PLAN.md` with the relevant `SAVINGS.md` section or remove redundant references.
3. Move `docs/SAVINGS_PLAN.md` to Trash after `rg` confirms it has no retained consumer.
4. Keep `docs/diagrams/savings-goals.c4` and `likec4.config.json`; update the diagram's stale brainstorm status and tags without redesigning it.
5. Add the durable savings documentation and diagram to `docs/INDEX.md`; keep the `CLAUDE.md` savings entry but remove its `SAVINGS_PLAN.md` row.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | The PR contains none of the 26 generated AIDD task files, the local Claude command, or `SAVINGS_PROGRESS.md`; new `aidd_docs/tasks/` content is ignored while `.claude/launch.json` and the pre-existing tracked `preview` task folder remain untouched. |
| 2 | `SAVINGS_PLAN.md` has no retained reference and is removed; `SAVINGS.md` contains the necessary simulator invariants; the retained LikeC4 diagram describes implemented reality and validates with its existing config. |
