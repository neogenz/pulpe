# 0013 — PostgreSQL RPCs for atomic multi-row writes

**Status:** Accepted
**Date:** 2026-08-12
**Deciders:** Pulpe team

## Context

Templates, tags, spreading, savings plans, withdrawals, and rekeying update related rows
whose invariants must commit or fail together. Sequencing independent PostgREST writes in
NestJS exposes partial states and race windows.

## Decision

When a write spans rows or tables and must be atomic, implement the transaction as a
PostgreSQL function called through `supabase.rpc(...)`.

- The backend prepares and validates ciphertext payloads before the call; PostgreSQL never
  receives a DEK or decrypts user amounts.
- Prefer invoker rights plus RLS. Use `SECURITY DEFINER` only for a required privileged
  boundary, with explicit ownership checks, an empty `search_path`, least-privilege grants,
  and integration coverage.
- JSONB payloads carrying ciphertext follow ADR-0007. Scalar parameters use generated types.

## Consequences

- Cross-table invariants, locks, and idempotency guards share one database transaction.
- SQL functions and grants become security-sensitive application code and require migration
  tests against local Supabase.
- Use cases remain responsible for business intent; an RPC is not a generic replacement for
  ordinary single-row repository writes.

## Alternatives considered

Application-side compensation was rejected because it cannot close concurrent write windows.
Adding an ORM only for transactions was rejected because Supabase functions already provide
the native boundary without a second persistence stack.

## References

- `backend-nest/docs/DATABASE.md`
- `backend-nest/supabase/migrations/`
- ADR-0007
