# 0004 — Repositories return decrypted entities

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

Before Tier 3, every read use case had to inject `ENCRYPTION_PORT`, derive the user DEK, and decrypt amount columns inline before returning entities. Five modules touched encryption (`budget`, `budget-line`, `budget-template`, `transaction`, `demo`). Encryption logic was scattered across 30+ use cases. The boundary between "the repository" and "the encryption ceremony" was nowhere.

This had real costs: bugs where one use case decrypted but another forgot, duplicated DEK derivation calls, and tests that had to mock both the repo and the encryption port.

## Decision

Repositories own the encryption boundary. On read, the repository decrypts amounts before returning entities; on write, it encrypts before persisting. Use cases work with plain numbers and never see ciphertext.

```typescript
@Injectable()
export class SupabaseBudgetLineRepository implements BudgetLineRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findById(id: string): Promise<BudgetLine> {
    const { data } = await this.supabaseProvider.client.from('budget_line').select('*').eq('id', id).single();
    const dek = await this.getDek();
    return this.toEntity(data, dek); // amount is `number` here
  }
}
```

Use cases inject only the repository port; they no longer inject `ENCRYPTION_PORT` for reads. Write use cases also stay clean — the repo encrypts inside `insert/update`.

## Consequences

- Positive: encryption logic is centralized in 5 repositories instead of 30+ use cases.
- Positive: use case tests stop mocking encryption. They mock the repo port.
- Positive: a future cipher migration touches repos only.
- Negative: repositories grow (typically +50-100 LOC for the decrypt/encrypt helpers). Trade-off accepted; concentrated complexity > scattered complexity.
- Negative: the `BudgetLine` entity type uses `number` for amounts, which differs from the raw DB row. Mappers in `infrastructure/mappers/` convert entities to API DTOs at the controller boundary.

## Alternatives considered

- Keep encryption in use cases: rejected — that's the smell we removed.
- A separate "decryption service" called by use cases: rejected — same scattering, different name.
- Database-level encryption (pgsodium, Supabase Vault): not viable for this product. The DEK is derived from a user-supplied PIN that the server never holds in cleartext storage. See `backend-nest/docs/ENCRYPTION.md` and ADR-0008.

## References

- `backend-nest/src/modules/budget-line/infrastructure/persistence/supabase-budget-line.repository.ts`
- `backend-nest/docs/CLEAN_ARCH_TIER_PLAN.md` — Tier 3 reasoning
- ADR-0008 (encryption decomposition), ADR-0009 (lint enforcement removed the carve-out)
