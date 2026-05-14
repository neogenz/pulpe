# 0010 — Deferred decisions (what we did NOT build)

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

When discussing the architecture, several patterns came up that are common in mature DDD or Clean Architecture stacks. We chose not to adopt them. This ADR records what we deferred and the conditions that would justify revisiting.

The forces behind every "no": small team, narrow product surface (personal finance), most domain rules are simple invariants and arithmetic, no async event-driven workflows, no multi-aggregate orchestration that escapes a single use case.

## Decision

Explicitly NOT adopted at this stage:

- **CQRS / mediator pattern.** No `ICommand` / `IQuery` / `IHandler`. Use cases call repository ports directly (ADR-0003). A mediator buys decoupling we don't need at our scale.
- **Full DDD aggregates.** Entities are typed aliases of generated DB rows, not aggregate roots with private invariants and identity. Pure validation lives in `<domain>.invariants.ts`.
- **Value objects.** No `Money`, `Email`, `UserId` wrapper types. Plain `number`, `string`, `string` (UUID). The cost of constructors + equality + serialization across hundreds of fields is not justified by the bug class it would prevent at our scale.
- **Domain events / event-sourcing / message bus.** No `BudgetCreated` event published anywhere. State changes are direct DB writes followed by cache invalidation. We have no consumer that subscribes to domain events.
- **Hexagonal-with-adapters terminology.** We use ports + tokens (the concept) without adopting "adapter" or "primary/secondary port" naming.
- **Repository returning aggregates only.** Repos return entities (sometimes lists). We do not enforce "load an aggregate, mutate, save the whole thing." Use cases call narrow methods like `repo.update(id, patch)`.
- **Public templates with cross-user encryption.** The `create_budget_from_template` RPC originally accepted `user_id IS NULL` templates (intended as system-shared). After per-user AES-256-GCM encryption was introduced, copying ciphertext across DEKs silently produced zero amounts via the `tryDecryptAmount` fallback. Migration `20260508120000_create_budget_from_template_owner_only.sql` restricts the RPC to the template owner. A real public-template feature would require a dedicated server-side re-encryption design (system DEK held server-side, decrypt under system DEK, re-encrypt under requester's DEK) and is intentionally deferred until product needs it.

## Consequences

- Positive: less ceremony, smaller mental model, faster onboarding.
- Positive: one obvious way to add a feature: add a use case + a repo method.
- Negative: when product complexity grows (cross-aggregate workflows, multi-step async flows, audit needs), some of these decisions will need revisiting. We accept that future cost.

## Conditions to revisit

- **CQRS / mediator:** if controllers grow many cross-cutting concerns (auditing, retries, idempotency keys) that need uniform handling.
- **Aggregates / value objects:** if domain logic exceeds invariants + arithmetic — e.g., complex tax calculations, currency conversions with state, multi-currency reconciliation that spans multiple entities.
- **Domain events:** if a second consumer (analytics, search index, notification system) needs to react to state changes without coupling to the writer.
- **Message bus:** if we add async work that must be durably retried (webhooks, third-party integrations).
- **Public templates:** if product wants to ship system-shared templates (curated starter packs, partner integrations). Design must specify: where the system DEK lives, how it's rotated, who can write public templates, and whether re-encryption happens at template creation time or at budget creation time.

## References

- ADR-0001 (the architecture we picked)
- ADR-0003 (use cases, no mediator)
- `backend-nest/docs/CLEAN_ARCH_TIER_PLAN.md` — non-goals section
