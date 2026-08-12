# 0011 — Allocation read-side boundary

**Status:** Accepted
**Date:** 2026-06-28
**Deciders:** Pulpe team

## Context

PUL-288 removed the `budget-line` ↔ `transaction` NestJS module cycle. The
cycle was not only a mapper problem: it exposed a product boundary that had no
home. Users reason about a `budget_line` as a forecast envelope and about
`transaction` rows as actuals that realize that envelope.

This relationship appears in the API as allocated transactions, spread
occurrences, and `consumed` progress. Keeping those relation endpoints inside
either feature made one module import the other's infrastructure.

## Decision

Create `allocation` as the read/presentation boundary for the relation
`prévu ↔ réel`.

`allocation` may own:

- HTTP routes whose response combines forecast and actual concepts, while
  keeping the public URL stable;
- response assembly for allocated transactions, spread occurrences, and
  transaction-to-budget-line spread results;
- imports of domain ports/tokens from `budget-line` and `transaction`.

`allocation` must not own:

- budget-line CRUD or fan-out writes;
- transaction CRUD;
- generic shared mappers or “anything used by two modules”.

The source modules expose narrow Symbol-token ports. `allocation` imports those
ports and maps the returned decrypted domain entities to the existing API
contracts.

## Consequences

- Positive: `BudgetLineModule` no longer imports `TransactionModule`; the
  remaining dependency is one-way from `transaction` to the budget-line fan-out
  port.
- Positive: cross-module infrastructure mappers are no longer exported as public
  dependencies.
- Negative: relation endpoints live in a separate module while preserving legacy
  URLs. This is intentional: URL shape is an API contract, not necessarily module
  ownership.

## References

- ADR-0001 — Three-layer Clean Architecture
- ADR-0002 — Cross-module communication via ports and tokens
- ADR-0009 — Dual lint enforcement
- `backend-nest/src/modules/allocation/`
- `docs/SPREAD.md`
