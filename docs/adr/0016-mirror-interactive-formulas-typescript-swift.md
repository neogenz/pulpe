# 0016 — Mirror only interaction-critical formulas in TypeScript and Swift

**Status:** Accepted
**Date:** 2026-08-03
**Recorded:** 2026-08-12 (retrospective)
**Deciders:** Pulpe team

## Context

Business formulas normally run from the shared TypeScript or server contract. Some iOS
controls must preview a result continuously while the user drags or types; a network round
trip for every interaction would be slow and unavailable offline.

## Decision

Keep TypeScript calculators in `shared/src/calculators/` authoritative. A formula earns a
hand-written Swift twin only when it must run synchronously under the user's finger.

- Change both implementations and both test suites in the same commit.
- Use identical numeric fixtures on each side.
- Do not mirror server-produced timelines or new formulas that lack an interactive need.
- TypeScript clients, including the proposed Android app, consume `pulpe-shared` directly.

## Consequences

- iOS interaction stays immediate while server and web calculations retain one shared source.
- The accepted duplication can drift because no cross-language build compares implementations;
  paired fixtures, file-scoped instructions, and review are the mitigation.
- New Swift formula ports require an explicit interaction constraint, not convenience.

## Alternatives considered

Server-only previews were rejected for latency and offline behavior. A code-generation pipeline
was rejected because the small set of pure formulas does not justify another build system.

## References

- `.claude/rules/00-architecture/formula-mirrors-ts-swift.md`
- `docs/SAVINGS.md`, `docs/SPREAD.md`
- ADR-0018
