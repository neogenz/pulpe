# 0007 — Zod schemas for RPC JSONB payloads

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

Some atomic database operations span tables protected by different RLS policies. We use PostgreSQL `SECURITY DEFINER` functions invoked through `supabase.rpc(...)`. Several of these functions take JSONB array params (e.g., bulk-insert encrypted lines) and use `jsonb_to_recordset(...)` server-side to project the JSONB into typed rows.

Two failure modes:

1. The Supabase TypeScript generator types JSONB params as `Json` (effectively `unknown`). A typo on a key compiles fine and ships.
2. `jsonb_to_recordset` silently maps unknown keys to `NULL`. If the JSONB key is wrong, the encrypted ciphertext column becomes `NULL` — silent data loss.

This is catastrophic for encrypted columns (`amount`, `target_amount`, `ending_balance`).

## Decision

Every RPC whose payload includes JSONB containing ciphertexts MUST validate the payload through a strict Zod schema before calling `supabase.rpc(...)`. Schemas live in `backend-nest/src/modules/<module>/infrastructure/persistence/schemas/`. Each object schema uses `.strict()` to reject extra keys. `ZodError` is wrapped in `BusinessException` with `{ cause }`.

Use cases never import these schemas. They are an internal repository concern: the repo validates outbound payload, calls the RPC, returns the result.

Active uses:

- `create_template_with_lines` (`backend-nest/src/modules/budget-template/infrastructure/persistence/schemas/`)
- `apply_template_line_operations` (same location)
- `rekey_user_encrypted_data` (`backend-nest/src/modules/encryption/infrastructure/persistence/schemas/`)

RPCs with only scalar params (`uuid`, `text`, `int`, `boolean`) are covered by generated TypeScript types and don't need Zod.

## Consequences

- Positive: silent ciphertext nullification is impossible — extra keys throw before the round trip.
- Positive: schemas are an executable contract that documents the JSONB shape.
- Positive: companion `.spec.ts` tests cover the strict-key behavior, null ciphertext for nullable columns, UUID format.
- Negative: each RPC carries an extra schema file. Cost is small relative to the failure mode it prevents.

## Alternatives considered

- Trust generated types: rejected — Supabase types JSONB as `Json`, no shape enforcement.
- Server-side Postgres validation: useful but late. We want to fail before the round trip and produce a clean error code.
- Manual `if (!payload.amount)` checks: rejected as fragile. Zod is the canonical declarative shape.

## References

- `backend-nest/src/modules/budget-template/infrastructure/persistence/schemas/`
- `backend-nest/src/modules/encryption/infrastructure/persistence/schemas/`
- `.claude/rules/03-frameworks-and-libraries/supabase.md` — RPC + Zod section
- ADR-0008 (encryption uses RPC + Zod for rekey)
