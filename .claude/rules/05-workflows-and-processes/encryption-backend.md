---
description: Split-key encryption for financial amounts — AES-256-GCM, HKDF, DEK derivation
paths:
  - "backend-nest/**/encrypt*.ts"
  - "backend-nest/**/budget*.ts"
  - "backend-nest/**/transaction*.ts"
  - "backend-nest/**/budget-line*.ts"
  - "backend-nest/**/template*.ts"
---

# Encryption (Backend)

Read `docs/ENCRYPTION.md` for the complete architecture. This rule summarizes the patterns for daily development.

## Architecture: Split-Key

```
DEK = HKDF-SHA256(clientKey + masterKey, salt, "pulpe-dek-{userId}")
```

| Factor | Origin | Storage |
|--------|--------|---------|
| `clientKey` | Frontend PBKDF2 from PIN code | `X-Client-Key` header, sessionStorage |
| `masterKey` | `ENCRYPTION_MASTER_KEY` env var | Server only |
| `salt` | Random per user | `user_encryption_key` table (service_role only) |

DEK is never stored — recalculated per request (with 5-min memory cache).

## Encrypted Columns

| Table | Column (type `text`) |
|-------|---------------------|
| `budget_line` | `amount` |
| `transaction` | `amount` |
| `template_line` | `amount` |
| `savings_goal` | `target_amount` |
| `monthly_budget` | `ending_balance` |

Each column stores AES-256-GCM ciphertext encoded in base64, or `null`.

## Write Rule

All financial amounts MUST be encrypted via `EncryptionService` before writing to the database. Use `prepareAmountData(amount, dek)` which returns `{ amount: encryptedCiphertext }`.

Demo mode uses `DEMO_CLIENT_KEY_BUFFER` — same encryption pipeline as real users.

## AES-256-GCM Format

```
base64(IV[12 bytes] || authTag[16 bytes] || ciphertext)
```

## Key Files

| File | Role |
|------|------|
| `encryption/infrastructure/crypto/aes-gcm.crypto-service.ts` | DEK derivation, AES-GCM encrypt/decrypt, wrap/unwrap, rekey RPC, cache. Implements `ENCRYPTION_PORT` (read-only primitives) + exposes wrap/unwrap/recovery for in-module use cases |
| `encryption/infrastructure/persistence/supabase-encryption-key.repository.ts` | CRUD `user_encryption_key` table. Implements `ENCRYPTION_KEY_REPOSITORY` port |
| `encryption/infrastructure/http/encryption.controller.ts` | `/salt`, `/validate-key`, `/vault-status`, `/setup-recovery`, `/regenerate-recovery`, `/verify-recovery`, `/recover`, `/change-pin` — controller injects use cases only |
| `encryption/application/*.use-case.ts` | 8 use cases per high-level flow (validate-user-key, setup-recovery-key, regenerate-recovery-key, verify-recovery-key, recover-with-recovery-key, change-pin, get-vault-status, get-user-salt) |
| `client-key-cleanup.interceptor.ts` | Wipes clientKey from memory after request (`buffer.fill(0)`) |

See [ADR-0008](../../../backend-nest/docs/adr/0008-encryption-service-decomposition.md) for the decomposition rationale.

## Patterns

Repositories own the encryption boundary post-Tier-3. Use cases work with plain numbers and never inject `ENCRYPTION_PORT` for read paths. See [ADR-0004](../../../backend-nest/docs/adr/0004-repos-return-decrypted-entities.md).

### Reading encrypted data (inside the repository)

```typescript
@Injectable()
export class SupabaseBudgetLineRepository implements BudgetLineRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findByBudgetId(budgetId: string): Promise<BudgetLine[]> {
    const { data } = await this.supabaseProvider.client
      .from('budget_line').select('*').eq('budget_id', budgetId);
    const dek = await this.getDek();
    return data.map(row => this.toEntity(row, dek));  // returns plain-number entities
  }
}
```

### Writing encrypted data (inside the repository)

```typescript
async insert(input: BudgetLineCreateInput): Promise<BudgetLine> {
  const user = this.supabaseProvider.user;
  const { amount: encryptedAmount } = await this.encryption.prepareAmountData(
    input.amount, user.id, user.clientKey,
  );
  const { data } = await this.supabaseProvider.client.from('budget_line')
    .insert({ ...this.toRow(input), amount: encryptedAmount }).select().single();
  const dek = await this.getDek();
  return this.toEntity(data, dek);
}
```

### Use case (no encryption awareness)

```typescript
async execute(input: BudgetLineCreate, user: AuthenticatedUser): Promise<BudgetLine> {
  BudgetLineInvariants.validateCreate(input);
  const entity = await this.repo.insert(input);  // plain numbers in, decrypted entity out
  await this.budgetRecalculation.recalculate(entity.budgetId, user.clientKey);
  return entity;
}
```

## Security Rules

- **Never** log financial amounts (encrypted or decrypted)
- **Never** store DEK — always derive from clientKey + masterKey + salt
- **Always** use `{ cause: error }` when catching encryption errors
- **Always** wipe clientKey from memory after use (`buffer.fill(0)`)
- `user_encryption_key` table: service_role only — RLS blocks authenticated/anon
- Rate limiting: `/validate-key` (5/min), `/recover` (5/hour)
