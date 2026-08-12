# 0015 — Defer semantic AAD for financial ciphertexts

**Status:** Accepted
**Date:** 2026-08-04
**Recorded:** 2026-08-12 (retrospective)
**Deciders:** Pulpe team

## Context

AES-GCM authenticates every ciphertext but Pulpe does not bind it to a semantic field with
additional authenticated data (AAD). A same-user database writer can therefore relocate an
`amount` ciphertext into another amount-shaped field. Cross-user relocation already fails
because each user has a distinct DEK.

## Decision

Do not add semantic AAD yet. The limited field-to-field protection does not justify changing
every encryption caller while reads still convert authentication failures to `0` or `null`.
That migration could silently hide valid user amounts after one incorrect field label.

If the decision is revisited, first make decryption failures fail closed. Then use a versioned
`v2:` envelope with AAD `{userId}:{semanticField}`, never a table or row identifier, and keep
backward-compatible reads with lazy rewrite on the next mutation.

## Consequences

- Same-user field relocation remains an accepted integrity risk for an attacker who already
  has database write access.
- Cross-user swaps remain blocked, while legitimate ciphertext propagation between templates
  and budgets continues to work.
- The explicit prerequisite and envelope design prevent a future partial AAD rollout.

## Alternatives considered

Binding to table or row identity was rejected because SQL legitimately copies encrypted
template amounts into budget rows. Immediate field AAD was rejected because its current
silent-fallback failure mode creates a larger data-integrity risk.

## References

- `docs/ENCRYPTION.md` — “Absence d'AAD sur les ciphertexts de montants”
- ADR-0012
