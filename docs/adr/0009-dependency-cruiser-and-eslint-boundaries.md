# 0009 — Dual lint enforcement: ESLint boundaries + dependency-cruiser

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

The layer rules from ADR-0001 only matter if they are enforced. A rule that lives in a markdown file gets violated within weeks. We needed automated enforcement that catches violations during development AND in CI, with no false negatives, while being fast enough to run per-file in the IDE.

ESLint gives us per-file feedback inside editors and during `bun run quality`. It does not see the full import graph and cannot reason about transitive cycles.

`dependency-cruiser` walks the entire import graph, resolves TypeScript paths, sees transitive cycles, and supports named exceptions. It is slower (whole-graph) and runs as a separate command at CI.

## Decision

Both layers run, neither replaces the other:

- **ESLint `eslint-plugin-boundaries`** (`backend-nest/eslint.config.js`): defines four element types (`domain`, `application`, `infrastructure`, `common`, `config`, `types`) and forbids `domain -> application|infrastructure` and `application -> infrastructure`. Plus a `no-restricted-imports` rule that bans `@nestjs/*`, `@supabase/*`, and `zod` from `domain/`. Runs on every save in the IDE and at `bun run quality`.

- **`dependency-cruiser`** (`backend-nest/.dependency-cruiser.cjs`, run via `bun run lint:arch`): same layer rules at the import-graph level, plus `no-cross-module-direct` (warn) which catches direct service imports across modules. Runs in CI.

The ONLY permanent exception in either tool: encryption's `application/*` may import `encryption/infrastructure/crypto/*`. Documented inline in both configs and in ADR-0008.

## Consequences

- Positive: violations surface instantly in the editor (ESLint) AND in CI (depcruise) — no way to ship a layer break.
- Positive: each tool catches what the other can't. ESLint = per-file speed. depcruise = transitive graph + named exceptions.
- Positive: when migrations need temporary carve-outs (Tier 1 had one for `application -> infrastructure/mappers`), depcruise's named-exception model documents intent. Tier 3 removed it.
- Negative: two configs to maintain in sync. Mitigated because the rule set is small and rarely changes.
- Negative: depcruise runs in CI only (slow for pre-commit). The IDE relies on ESLint for fast feedback.

## Alternatives considered

- ESLint alone: rejected. Cannot detect transitive cycles or model named graph exceptions cleanly.
- dependency-cruiser alone: rejected. No IDE feedback; violations only surface at CI.
- TypeScript project references: useful but blunt — too granular configuration cost for what we get vs. lint rules.
- `nx` workspace boundaries: rejected. The repo is `pnpm + Turbo`, not nx.

## References

- `backend-nest/eslint.config.js` — `boundaries/element-types` rule
- `backend-nest/.dependency-cruiser.cjs` — full rule set + permanent carve-out
- ADR-0001, ADR-0008
