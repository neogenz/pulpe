# 0008 — Encryption service decomposition

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

The original `EncryptionService` was a 1048-LOC class. It mixed:

- Cryptographic primitives: AES-256-GCM encrypt/decrypt, HKDF, PBKDF2, key wrap/unwrap, IV generation.
- High-level flows: PIN setup, PIN change, recovery key setup, recovery flow, vault status, key rekeying.
- Caching: 5-minute DEK in-memory cache.

Every consumer injected the same fat service even when they only needed `encryptAmount`. Tests pulled in everything. The single class made it impossible to enforce the layered architecture (an HKDF helper sat next to a PIN-change orchestration).

## Decision

Tier 2C split the service into:

- `infrastructure/crypto/aes-gcm.crypto-service.ts` — `AesGcmCryptoService`, the primitives. Lives in `infrastructure/` because it touches Node's `crypto` and Buffers.
- `application/*.use-case.ts` — 8 use cases for the high-level flows: `change-pin`, `validate-user-key`, `setup-recovery-key`, `regenerate-recovery-key`, `verify-recovery-key`, `recover-with-recovery-key`, `get-user-salt`, `get-vault-status`.
- `domain/ports/encryption.port.ts` — the public `EncryptionPort` interface, exposing only the read-only primitives needed by other modules (`encryptAmount`, `decryptAmount`, `prepareAmountData`, `ensureUserDEK`, etc.).

The encryption module wires `ENCRYPTION_PORT` to `AesGcmCryptoService` (`useExisting`). Cross-module consumers see only the port.

A permanent single carve-out exists in `.dependency-cruiser.cjs`: the encryption module's `application/*` may import from `infrastructure/crypto/*`. Reason: the encryption module IS the crypto layer; its use cases need primitives that are intentionally NOT on the public port.

## Consequences

- Positive: `EncryptionPort` is the locked-down surface for the rest of the codebase. Adding a method requires editing the port + the implementation.
- Positive: each flow (PIN change, recovery, etc.) is a single-execute use case (ADR-0003), testable in isolation.
- Positive: AES/HKDF primitives are byte-identical to the previous implementation — no protocol change.
- Negative: one permanent depcruise exception, documented in `.dependency-cruiser.cjs`. Trade-off accepted; a generic "infrastructure detail in application" rule with a single named exception is cleaner than a fake port that just re-exports private primitives.

## Alternatives considered

- Keep the monolith: rejected. Could not enforce layer boundaries without it.
- Expose all primitives on `ENCRYPTION_PORT`: rejected. The port would become a dump of every internal helper, bloating the cross-module surface.
- Move primitives to `domain/`: rejected. Crypto primitives use `node:buffer` and `node:crypto`, which we keep out of `domain/` (ADR-0001).

## References

- `backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts`
- `backend-nest/src/modules/encryption/application/` — 8 use cases
- `backend-nest/src/modules/encryption/domain/ports/encryption.port.ts`
- `backend-nest/.dependency-cruiser.cjs` — permanent carve-out
- `backend-nest/docs/ENCRYPTION.md` — full crypto architecture
- ADR-0001, ADR-0009
