# AI Operating Guidelines

How AI coding assistants operate on Pulpe. Keep this file short; do not duplicate the detailed project rules.

## House rules

- `CLAUDE.md` and its `AGENTS.md` symlink are the canonical behavior, safety, workflow, and vocabulary instructions.
- Path-specific implementation rules live under `.claude/rules/` and take precedence for matching files.
- Product and visual decisions remain canonical in `PRODUCT.md`, `DESIGN.md`, and the platform design extensions; memory files point to them instead of copying them.

## Validation depth

- During iteration, run the narrowest relevant package check or test.
- Before a commit, run `pnpm quality`; before merge, run the tests relevant to the changed behavior.

## When the AI drifts

- Stop edits, restate the objective in one sentence, and reload the relevant project memory and path-specific rules before continuing.

For the general AIDD playbook, see the [framework documentation](https://github.com/ai-driven-dev/framework).
