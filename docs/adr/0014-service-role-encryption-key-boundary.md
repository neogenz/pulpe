# 0014 — Service-role boundary for encryption-key metadata

**Status:** Accepted
**Date:** 2026-08-04
**Recorded:** 2026-08-12 (retrospective)
**Deciders:** Pulpe team

## Context

The historical rekey RPC ran with the user's JWT and required partial `authenticated` grants
on `user_encryption_key`. A stolen session could therefore overwrite `key_check` directly
through PostgREST and make that user's vault unreadable.

## Decision

Treat encryption-key metadata and rekey entry points as privileged infrastructure:

- `user_encryption_key` is readable and writable only through the `service_role` client;
- `authenticated` and `anon` receive neither table privileges nor RPC execution rights;
- the encryption-key repository invokes the bounded rekey entry point with `service_role`;
- privileged functions remain narrowly scoped to the supplied user, lock before mutation,
  use an empty `search_path`, and keep their unguarded core unreachable directly.

## Consequences

- A user JWT cannot modify the canary or invoke rekeying outside the backend flow.
- The backend service-role credential becomes a higher-value secret and must never reach a
  client, log, test fixture, or user-data repository by convenience.
- Encryption and account deletion remain explicit exceptions to the authenticated-provider
  default established by ADR-0006.

## Alternatives considered

Keeping column-level authenticated grants with RLS was rejected because the legitimate flow
does not require direct PostgREST access. A user-executable `SECURITY DEFINER` function was
also rejected because it preserved an unnecessary public privilege surface.

## References

- `backend-nest/supabase/migrations/20260804130000_lock_down_user_encryption_key.sql`
- `docs/ENCRYPTION.md`
- ADR-0006, ADR-0008, ADR-0013
