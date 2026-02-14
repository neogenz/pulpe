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

| Table | Plaintext Column | Encrypted Column |
|-------|-----------------|-----------------|
| `budget_line` | `amount` | `amount_encrypted` |
| `transaction` | `amount` | `amount_encrypted` |
| `template_line` | `amount` | `amount_encrypted` |
| `savings_goal` | `target_amount` | `target_amount_encrypted` |
| `monthly_budget` | `ending_balance` | `ending_balance_encrypted` |

## Write Rule

When `clientKey` is present (header `X-Client-Key`):
- Plaintext columns (`amount`, `target_amount`, `ending_balance`) = **`0`**
- Encrypted columns (`*_encrypted`) = AES-256-GCM ciphertext (base64)

When no `clientKey` (demo mode):
- Plaintext columns = **real values**
- Encrypted columns = empty/null

## AES-256-GCM Format

```
base64(IV[12 bytes] || authTag[16 bytes] || ciphertext)
```

## Key Files

| File | Role |
|------|------|
| `encryption.service.ts` | DEK derivation, AES-GCM encrypt/decrypt, wrap/unwrap, cache |
| `encryption-key.repository.ts` | CRUD `user_encryption_key` table |
| `encryption-rekey.service.ts` | Re-encrypt all data on PIN migration |
| `encryption.controller.ts` | `/salt`, `/validate-key`, `/rekey`, `/setup-recovery`, `/recover` |
| `client-key-cleanup.interceptor.ts` | Wipes clientKey from memory after request (`buffer.fill(0)`) |
| `encryption-backfill.interceptor.ts` | Auto-encrypts plaintext data on first request |
| `skip-backfill.decorator.ts` | `@SkipBackfill()` — prevents backfill on rekey endpoint |

## Patterns

### Reading Encrypted Data

```typescript
// Service decrypts after DB read
const budgetLines = await this.repository.findByBudgetId(budgetId, supabase);
return budgetLines.map(line => ({
  ...line,
  amount: this.encryptionService.decrypt(line.amount_encrypted, dek),
}));
```

### Writing Encrypted Data

```typescript
// Service encrypts before DB write
const encryptedAmount = this.encryptionService.encrypt(dto.amount, dek);
await this.repository.create({
  ...dto,
  amount: 0,                          // Plaintext = 0
  amount_encrypted: encryptedAmount,  // Real value encrypted
}, supabase);
```

## Security Rules

- **Never** log financial amounts (encrypted or decrypted)
- **Never** store DEK — always derive from clientKey + masterKey + salt
- **Always** use `{ cause: error }` when catching encryption errors
- **Always** wipe clientKey from memory after use (`buffer.fill(0)`)
- `user_encryption_key` table: service_role only — RLS blocks authenticated/anon
- Rate limiting: `/validate-key` (5/min), `/rekey` (3/hour), `/recover` (5/hour)
