---
status: done
---

# Instruction: close-the-failing-gate-and-verify-merge-readiness

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── frontend/e2e
│   ├── tests/features/savings-goals-progress.spec.ts            ✏️ select the card by stable goal ID
│   └── utils/auth-bypass.ts                                     ✏️ suppress the savings-goals product tour in deterministic E2E setup
└── skills-lock.json                                             ✏️ retain the required local skill-lock additions
```

## Tasks to do

### `1)` Resolve the current feature E2E failure

> GitHub Actions has one failing feature test: `getByTestId('savings-goal-Vacances été 2027')` does not match the component's ID-based test contract.

1. Preserve the existing uncommitted change selecting `savings-goal-${GOAL_ID}`.
2. Preserve the existing uncommitted `savings-goals` tour bypass so the new intro does not intercept deterministic feature tests.
3. Run only `frontend/e2e/tests/features/savings-goals-progress.spec.ts`; require a green result before broader gates.

### `2)` Preserve the required skill lock and eliminate accidental dirty-worktree noise

> The current `skills-lock.json` additions are required and intentionally belong in the final branch state.

1. Preserve the current `skills-lock.json` additions and validate the JSON/lock consistency with the repository's normal skill-lock check, if one exists.
2. Review `git status` and `git diff origin/preview...HEAD` to ensure every remaining path is intentional, including the required launch config, LikeC4 diagram, and skill lock.
3. Run `git diff --check`.

### `3)` Prove the cleaned PR is merge-ready

> Cleanup is complete only after the branch and remote checks agree.

1. Run the renamed shared schema suite, the targeted frontend E2E suite, and iOS UI-test target compilation.
2. Run `pnpm quality` and the repository test/build gates affected by the cleanup.
3. Push only if explicitly authorized; otherwise report the exact local commands and outputs and leave commits/push pending.
4. After push, require all mandatory PR #510 checks green and re-check that the PR still targets `preview` and is mergeable.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | The savings-goals feature E2E passes using a stable ID and is not blocked by the first-visit tour. |
| 2 | `skills-lock.json` retains the required additions and passes its available consistency check; `git diff --check` reports no whitespace errors; the cleaned diff has no unknown work artifact. |
| 3 | `pnpm quality` and affected test/build gates pass locally; after any authorized push, PR #510 has no failing required check. |
