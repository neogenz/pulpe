# 0012 — Split-key financial encryption

**Status:** Accepted
**Date:** 2026-02-12
**Recorded:** 2026-08-12 (retrospective)
**Deciders:** Pulpe team

## Context

Pulpe stores sensitive financial amounts while the backend still needs to calculate and
serve them. A database dump or one leaked server secret must not reveal those amounts.

## Decision

Encrypt financial amounts with AES-256-GCM under a per-user data-encryption key (DEK):

- the client derives `clientKey` from the user's PIN with PBKDF2;
- the server combines `clientKey`, `ENCRYPTION_MASTER_KEY`, the user's random salt, and a
  user-bound HKDF context to derive the DEK;
- the DEK is never persisted; `key_check` validates it and a separately held recovery key
  may wrap it for PIN recovery;
- repositories own ciphertext conversion as decided by ADR-0004.

## Consequences

- A database-only, master-key-only, or client-key-only leak cannot decrypt amounts.
- Requests carrying financial data must transport `X-Client-Key`; the server temporarily
  holds both factors and must keep logs, caches, and cleanup paths hardened.
- PIN brute force, recovery, rekey atomicity, and client-key storage remain explicit security
  trade-offs documented and tested in the encryption subsystem.

## Alternatives considered

Server-only encryption was rejected because compromising the running backend, or combining a
database leak with the server-held key, would expose every amount without a client-held factor.
Database-side encryption was rejected because it would either colocate key material with the
ciphertexts or move the same server-secret risk into the database infrastructure. Client-only
encryption was rejected because the backend must enforce financial invariants and calculate
projections.

## References

- `docs/ENCRYPTION.md`
- ADR-0004, ADR-0008
