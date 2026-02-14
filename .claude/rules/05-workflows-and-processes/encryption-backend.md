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
| `encryption.service.ts` | DEK derivation, AES-GCM encrypt/decrypt, wrap/unwrap, rekey, cache |
| `encryption-key.repository.ts` | CRUD `user_encryption_key` table |
| `encryption.controller.ts` | `/salt`, `/validate-key`, `/setup-recovery`, `/recover` |
| `client-key-cleanup.interceptor.ts` | Wipes clientKey from memory after request (`buffer.fill(0)`) |

## Patterns

### Reading Encrypted Data

```typescript
// Service decrypts after DB read
const budgetLines = await this.repository.findByBudgetId(budgetId, supabase);
return budgetLines.map(line => ({
  ...line,
  amount: this.encryptionService.decrypt(line.amount, dek),
}));
```

### Writing Encrypted Data

```typescript
// Service encrypts before DB write
const amountData = this.encryptionService.prepareAmountData(dto.amount, dek);
await this.repository.create({
  ...dto,
  ...amountData,  // { amount: encryptedCiphertext }
}, supabase);
```

## Security Rules

- **Never** log financial amounts (encrypted or decrypted)
- **Never** store DEK — always derive from clientKey + masterKey + salt
- **Always** use `{ cause: error }` when catching encryption errors
- **Always** wipe clientKey from memory after use (`buffer.fill(0)`)
- `user_encryption_key` table: service_role only — RLS blocks authenticated/anon
- Rate limiting: `/validate-key` (5/min), `/recover` (5/hour)
