# 0001 — Three-layer Clean Architecture

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

The backend started as a flat `controller / service / repository / mapper / dto` layout per module. As encryption, cross-module orchestration, and RPC schemas multiplied, services grew past 1000 LOC and the dependency graph became hard to enforce. We needed structure that scales without dragging in full DDD ceremony.

We are a small team. The product is a personal-finance app: most modules carry simple invariants and CRUD, with a single security-critical module (encryption). Heavy patterns (CQRS, mediator, value objects, aggregates with repositories returning aggregates only) would cost more than they pay back at our scale.

## Decision

Each module under `backend-nest/src/modules/<domain>/` is split into three layers:

- `domain/` — entity types (typically aliases of generated DB rows), pure invariants, optional formulas, port interfaces with Symbol tokens. No `@nestjs/*`, no `@supabase/*`, no `zod`.
- `application/` — `*.use-case.ts` files: `@Injectable` classes with a single `execute()` method. May import from `domain/` and `src/common/`. May NOT import from any `infrastructure/`.
- `infrastructure/` — controllers (`http/`), repositories (`persistence/`), mappers (`mappers/`), Zod schemas for RPC payloads (`persistence/schemas/`). All framework code lives here.

The dependency rule is one-way: `infrastructure -> application -> domain`. Cross-module communication uses ports + tokens (see ADR-0002).

## Consequences

- Positive: each module is self-contained and grep-able; new contributors find code by layer; lint enforces the rule mechanically.
- Positive: refactors stay local; swapping Supabase for another driver only touches `infrastructure/persistence/`.
- Negative: small modules look heavier than they used to (more folders, more tokens). Trade-off accepted because the consistency wins outweigh boilerplate.
- Negative: developers must know which layer owns what. Mitigated by the rule in `.claude/rules/00-architecture/nestjs-architecture.md` and ADR-0009 enforcement.

## Alternatives considered

- Keep the flat layout: rejected. It hid encryption logic across services and made cross-module imports trivial to misuse.
- Hexagonal (ports + adapters terminology): rejected as overkill naming. We use the concept (ports + tokens) without the vocabulary.
- Full DDD (aggregates, value objects, domain events): rejected. See ADR-0010.

## References

- `backend-nest/src/modules/budget-line/` — smallest reference module
- `.claude/rules/00-architecture/nestjs-architecture.md`
- ADR-0002, ADR-0003, ADR-0009
