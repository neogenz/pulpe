# Clean Architecture — Tier 2 + Tier 3 Implementation Plan

> Self-contained brief for an autonomous agent. Read top to bottom before touching code. Phase 0–6 already shipped (43 commits on `neogenz/marseille`). This plan covers the remaining caveats.

## 0. Snapshot (state when this plan was written)

| Item | Value |
|------|-------|
| Branch | `neogenz/marseille` |
| Last commit | `f60555166` (chore(backend): remove dead flat-layout files) |
| Tests | 560/560 pass |
| Quality | 0 errors, 26 pre-existing `max-lines-per-function` warnings |
| Prettier | clean |
| `lint:arch` | 34 errors — `no-application-to-infrastructure` (use cases import mappers from infrastructure/) |

Verify before starting:
```bash
cd /Users/maximedesogus/conductor/workspaces/pulpe-workspace/marseille
git log --oneline -1                           # f60555166 expected
git status --short                              # empty
cd backend-nest && bun test 2>&1 | tail -3      # 560/560 pass
cd backend-nest && bun run quality 2>&1 | tail -3   # 0 errors
cd backend-nest && bun run lint:arch 2>&1 | tail -5  # 34 errors expected
```

If any of the above doesn't match, **STOP** and reconcile before proceeding.

## 1. Goals & Non-Goals

### Goals

1. **Tier 1 — Lint:arch clean.** Add temporary `dep-cruiser` carve-out for `application → infrastructure/mappers/`. 1 commit.
2. **Tier 2 — Module consistency.** Migrate `account-deletion`, `user`, `encryption` modules to the 3-layer pattern that the other 5 modules already follow. ~16 commits.
3. **Tier 3 — Repos return entities.** Repositories decrypt internally and return decrypted domain entities. Use cases no longer inject `ENCRYPTION_PORT` for read paths. Mappers stop being imported from use cases (they live in `infrastructure/http/` for entity → DTO conversion at controller boundary). Removes the Tier 1 carve-out as a side effect. ~26 commits.

### Non-Goals (explicit)

- No new modules. No new features.
- No CQRS, mediator, event bus, value objects.
- No migration of `account-deletion`, `user` to entity-returning repos in Tier 3 (they don't have encryption, the gain is small).
- No refactor of AES-GCM / HKDF crypto primitives — they stay byte-identical.
- No `--no-verify` ever. No history rewrites. No force pushes.

## 2. Conventions kept (do NOT change)

| Pattern | Reference |
|---------|-----------|
| `BusinessException` + `ERROR_DEFINITIONS` | `.claude/rules/05-workflows-and-processes/error-handling-backend.md` |
| `InfoLogger` (no `error` method — split logger) | `backend-nest/src/common/logger/info-logger.interface.ts` |
| `GlobalExceptionFilter` is the only place errors are logged | `backend-nest/src/common/filters/global-exception.filter.ts` |
| Encryption rules — every encrypted column goes through `ENCRYPTION_PORT` | `.claude/rules/05-workflows-and-processes/encryption-backend.md` |
| `AuthGuard` stashes user + supabase in CLS | `backend-nest/src/common/guards/auth.guard.ts` |
| `AuthenticatedSupabaseProvider` reads from CLS | `backend-nest/src/modules/supabase/authenticated-supabase.provider.ts` |
| Module wiring: `createInfoLoggerProvider(ClassName.name)` per `@InjectInfoLogger` | `backend-nest/docs/ARCHITECTURE.md` |
| Cross-module communication via ports + tokens, never direct service imports | `backend-nest/.dependency-cruiser.cjs` |
| RLS preserved on all queries except documented service-role calls (encryption-key, account-deletion, demo cleanup) | n/a |

## 3. Templates (READ before each tier)

Already-migrated modules to use as structural templates:

| Module | Use as template for |
|--------|---------------------|
| `backend-nest/src/modules/budget-line/` | Smallest reference. Read first. |
| `backend-nest/src/modules/transaction/` | Mid-size. Has search use case (cross-table). |
| `backend-nest/src/modules/budget/` | Largest. Has cache.getOrSet. Exposes `BUDGET_RECALCULATION_PORT`. |
| `backend-nest/src/modules/budget-template/` | Has RPC payload Zod schemas in `infrastructure/persistence/schemas/`. |
| `backend-nest/src/modules/demo/` | Has cron scheduler, service-role admin calls, pure data files. |

For each task below, **READ at least 3 sibling files** before editing per the project's pre-edit checklist (CLAUDE.md).

---

# Tier 1 — Dep-Cruiser Carve-Out

## Goal

Make `bun run lint:arch` pass with 0 errors. This is a **temporary** measure; Tier 3 removes the carve-out by eliminating the underlying smell (use cases will not import mappers).

## Estimated effort

1 commit, ~10 minutes.

## Files

- `backend-nest/.dependency-cruiser.cjs`

## Steps

1. **Verify state**:
   ```bash
   cd backend-nest && bun run lint:arch 2>&1 | tail -10
   ```
   Should show 34 errors of type `no-application-to-infrastructure` pointing at imports from use cases to `infrastructure/mappers/*`.

2. **Edit `.dependency-cruiser.cjs`**: locate the rule named `no-application-to-infrastructure` and add `pathNot` to the `to` clause:
   ```javascript
   {
     name: 'no-application-to-infrastructure',
     severity: 'error',
     comment: 'TEMPORARY: mappers exception until Tier 3 (repos return entities). Remove pathNot when use cases stop importing mappers.',
     from: { path: '^src/modules/[^/]+/application' },
     to: {
       path: '^src/modules/[^/]+/infrastructure',
       pathNot: '^src/modules/[^/]+/infrastructure/mappers',
     },
   },
   ```

3. **Verify**:
   ```bash
   cd backend-nest
   bun run lint:arch       # 0 errors
   bun test 2>&1 | tail -3  # 560/560
   bun run quality          # 0 errors
   ```

4. **Commit**:
   ```bash
   git add backend-nest/.dependency-cruiser.cjs
   git commit -m "chore(backend): carve-out application→infrastructure/mappers in dep-cruiser" \
     -m "Temporary exception to unblock lint:arch. Will be removed in Tier 3 when use cases stop importing mappers (repos return decrypted entities directly)."
   ```

## Acceptance

- [ ] 1 commit on `neogenz/marseille`
- [ ] `bun run lint:arch` returns 0 errors
- [ ] 560/560 tests still pass
- [ ] `bun run quality` clean
- [ ] Carve-out comment marks it TEMPORARY

## Stop conditions

- Tests regress → revert commit, investigate.
- `lint:arch` still has errors → the rule pattern was wrong; inspect and adjust the regex.

---

# Tier 2 — Migrate 3 Modules to 3-Layer

## Goal

Bring `account-deletion`, `user`, `encryption` modules to structural parity with the other 5 already-migrated modules.

## Estimated effort

~16 commits across 3 sub-tiers. Sub-tiers are **independent** (different files). Can run in parallel via 3 implementer agents, but commit race on the same branch is a real risk (we hit it in Phase 0). **Recommended: sequential**, one agent per sub-tier.

## Pre-read (mandatory)

Before each sub-tier:
- Read `backend-nest/src/modules/budget-line/` files (smallest reference).
- Read `.claude/rules/00-architecture/nestjs-architecture.md` (post-Phase 6 version).
- Read `backend-nest/docs/ARCHITECTURE.md`.
- Run `git log --oneline -10` to see most recent migration patterns.

## Common per-module pattern (5 commits each)

1. **Domain layer** — `domain/<module>.entity.ts`, `domain/<module>.invariants.ts`, `domain/ports/<module>-repository.port.ts`, `<module>.tokens.ts`. Service untouched.
2. **Repository** — `infrastructure/persistence/supabase-<module>.repository.ts` implementing the port. Wire token mapping in module. Service still works (additive).
3. **Use cases** — split service into single-method `@Injectable` use cases under `application/`. Service still exists; module wires both.
4. **Rewire controller + module + tests** — move controller to `infrastructure/http/`, move DTOs, update module providers (remove old service, register use cases + `createInfoLoggerProvider` per class). Delete old root-level service file.
5. **Tests** — delete old `.service.spec.ts`, add `domain/<module>.invariants.spec.ts`, `infrastructure/persistence/supabase-<module>.repository.spec.ts`, at minimum one `application/*.use-case.spec.ts`.

## Quality gates per commit

Per commit:
```bash
cd backend-nest
bun test src/modules/<module>   # ALL pass for that module
bun run quality                  # 0 errors
bun run lint:arch                # 0 errors (with Tier 1 carve-out in place)
```

After all sub-tiers complete, full sweep:
```bash
bun test                         # all 560+ pass
bun run quality                  # 0 errors
bun run lint:arch                # 0 errors
```

## Sub-Tier 2A — `account-deletion`

### Specifics

- Uses `getServiceRoleClient()` for admin user operations (cascade deletion, auth.users mutations).
- **NOT CLS-migrated** — repo takes explicit `supabase` param OR injects `SupabaseService` and pulls the service-role client internally. Choose the latter (cleaner — repo constructor takes `SupabaseService`, calls `getServiceRoleClient()` lazily per method).
- May have a cron job for grace-period expiry processing — keep it as `infrastructure/scheduler/account-deletion.cron.ts` (`@Injectable() @Cron(...)` calling a use case).
- Has `account-deletion.integration.spec.ts` — must continue passing. NB: this test was the one that broke during Phase 4 (CLS migration) — it required `SupabaseModule` to import `ClsModule`. That fix is already shipped.

### Target structure

```
backend-nest/src/modules/account-deletion/
├── domain/
│   ├── account-deletion.entity.ts          # DeletionRequest, DeletionStatus
│   ├── account-deletion.invariants.ts      # eligibility checks (pure)
│   └── ports/
│       └── account-deletion-repository.port.ts
├── application/
│   ├── schedule-account-deletion.use-case.ts
│   ├── cancel-account-deletion.use-case.ts
│   ├── execute-account-deletion.use-case.ts    # cron-invoked (removes user + cascade)
│   ├── get-deletion-status.use-case.ts
│   └── cleanup-expired-deletions.use-case.ts   # if applicable
├── infrastructure/
│   ├── http/
│   │   ├── account-deletion.controller.ts
│   │   └── dto/
│   ├── persistence/
│   │   └── supabase-account-deletion.repository.ts
│   └── scheduler/
│       └── account-deletion.cron.ts            # if cron exists
├── account-deletion.module.ts
├── account-deletion.tokens.ts                  # ACCOUNT_DELETION_REPOSITORY symbol
└── index.ts
```

### Acceptance

- [ ] 5 commits on branch (one per step in the common pattern)
- [ ] Old `account-deletion.service.ts` deleted; replaced by use cases
- [ ] `account-deletion.integration.spec.ts` passes unchanged or with mock-token updates only
- [ ] No direct supabase calls outside `infrastructure/persistence/`
- [ ] `bun run quality` clean
- [ ] `bun run lint:arch` clean

## Sub-Tier 2B — `user`

### Specifics

- Likely 4 endpoints: getProfile, updateProfile, getSettings, updateSettings (deleteAccount may live here OR in account-deletion — preserve current routing).
- Uses `@SupabaseClient()` decorator (CLS-provided post-Phase 4). Repo can use `AuthenticatedSupabaseProvider` directly.
- May or may not have a separate `user.service.ts` (post-Phase 0 strip might have collapsed it). Inspect first.

### Target structure

```
backend-nest/src/modules/user/
├── domain/
│   ├── user.entity.ts                # UserProfile, UserSettings (camelCase)
│   ├── user.invariants.ts            # validate update payloads
│   └── ports/
│       └── user-repository.port.ts
├── application/
│   ├── get-user-profile.use-case.ts
│   ├── update-user-profile.use-case.ts
│   ├── get-user-settings.use-case.ts
│   └── update-user-settings.use-case.ts
├── infrastructure/
│   ├── http/
│   │   ├── user.controller.ts
│   │   └── dto/
│   └── persistence/
│       └── supabase-user.repository.ts        # uses AuthenticatedSupabaseProvider
├── user.module.ts
├── user.tokens.ts                              # USER_REPOSITORY
└── index.ts
```

### Cross-module concern: `deleteAccount`

If `user.controller` exposes `DELETE /me` that triggers account deletion:
- Use case `delete-account.use-case.ts` (in user module) injects the `account-deletion` use case (e.g., `ScheduleAccountDeletionUseCase`).
- Use direct DI for now (cross-module class injection). Tier 3 may introduce a port if needed; for now, accept the coupling.

Alternative: move `DELETE /me` to `account-deletion.controller`. Either is acceptable — preserve current routing to avoid frontend breakage.

### Acceptance

- [ ] 5 commits
- [ ] Old `user.service.ts` (if it exists) deleted; thin controller injects use cases only
- [ ] All `user` endpoints return identical response shapes (frontend contract)
- [ ] `bun run quality` clean
- [ ] `bun run lint:arch` clean

## Sub-Tier 2C — `encryption`

### Specifics — security-critical, do not refactor primitives

`encryption.service.ts` is 1048 LOC and does:
- AES-GCM primitives (encrypt/decrypt/wrap/unwrap)
- HKDF DEK derivation
- DEK 5-min in-memory cache
- Recovery key generation/wrap/unwrap
- Key check generation/validation
- High-level flows: createRecoveryKey, regenerateRecoveryKey, recoverWithKey, verifyRecoveryKey, changePinRekey, validate-key flow, vault status, salt fetch
- Bulk re-encryption RPC (`rekey_user_encrypted_data`)

`ENCRYPTION_PORT` already exists (`backend-nest/src/modules/encryption/domain/ports/encryption.port.ts`) — DO NOT change its interface. The port covers primitives only.

### Decomposition strategy

| Today | Tomorrow |
|-------|----------|
| `encryption.service.ts` does everything | Split: AES-GCM crypto adapter (primitives) + use cases (high-level flows) |
| Controller injects `EncryptionService` directly | Controller injects use cases |

### Target structure

```
backend-nest/src/modules/encryption/
├── domain/
│   ├── encryption.entity.ts                # UserEncryptionKey, RecoveryKey, VaultStatus types
│   ├── encryption.constants.ts             # algorithm names, lengths, TTL
│   └── ports/
│       ├── encryption.port.ts              # ALREADY EXISTS — keep
│       └── encryption-key-repository.port.ts   # NEW
├── application/
│   ├── get-vault-status.use-case.ts
│   ├── get-user-salt.use-case.ts
│   ├── validate-user-key.use-case.ts            # was verifyAndEnsureKeyCheck
│   ├── setup-recovery-key.use-case.ts           # was createRecoveryKey
│   ├── regenerate-recovery-key.use-case.ts
│   ├── verify-recovery-key.use-case.ts
│   ├── recover-with-recovery-key.use-case.ts    # was recoverWithKey
│   └── change-pin.use-case.ts                   # was changePinRekey
├── infrastructure/
│   ├── http/
│   │   ├── encryption.controller.ts          # moved; injects use cases
│   │   └── dto/
│   │       └── encryption-swagger.dto.ts
│   ├── persistence/
│   │   └── supabase-encryption-key.repository.ts   # moved + implements port
│   └── crypto/
│       └── aes-gcm.crypto-service.ts          # renamed EncryptionService
├── encryption.module.ts
├── encryption.tokens.ts                        # re-exports ENCRYPTION_PORT + ENCRYPTION_KEY_REPOSITORY
└── index.ts
```

`AesGcmCryptoService` keeps **all current `EncryptionService` methods byte-for-byte identical** (just renamed class). It implements `EncryptionPort` (for primitives) AND exposes the additional methods (wrap/unwrap, recovery key generation, key check, rekey RPC) that use cases need. Use cases inject the concrete service for those advanced ops, not the port (the port is the read-only surface for application use cases that only need crypto primitives).

### Module wiring

```typescript
@Global()
@Module({
  imports: [ClsModule],
  controllers: [EncryptionController],
  providers: [
    AesGcmCryptoService,
    SupabaseEncryptionKeyRepository,
    GetVaultStatusUseCase,
    GetUserSaltUseCase,
    ValidateUserKeyUseCase,
    SetupRecoveryKeyUseCase,
    RegenerateRecoveryKeyUseCase,
    VerifyRecoveryKeyUseCase,
    RecoverWithRecoveryKeyUseCase,
    ChangePinUseCase,
    { provide: ENCRYPTION_PORT, useExisting: AesGcmCryptoService },
    { provide: ENCRYPTION_KEY_REPOSITORY, useClass: SupabaseEncryptionKeyRepository },
    createInfoLoggerProvider(EncryptionController.name),
    createInfoLoggerProvider(AesGcmCryptoService.name),
    // + per use case
  ],
  exports: [ENCRYPTION_PORT, AesGcmCryptoService],
})
export class EncryptionModule {}
```

### CRITICAL safety checks

- AES-GCM bytes IDENTICAL after refactor. If uncertain, write a comparative test: encrypt the same plaintext with old + new code paths and compare ciphertext bytes (will fail because GCM uses random IV — instead compare `decrypt(encrypt(x)) === x` for round-trip integrity).
- DEK cache TTL unchanged (5 min).
- DEK cache invalidation on PIN change preserved.
- Rate limits preserved at controller level: `validate-key` (5/min), `recover` (5/hour).
- `@SkipClientKey()` decorator preserved on appropriate endpoints.
- All encryption tests (3128 LOC `encryption.service.spec` + integration + e2e + http + rate-limit) MUST continue passing.

### Sequential commits (6, not 5)

1. Domain layer + `ENCRYPTION_KEY_REPOSITORY` port (interface only)
2. Move `EncryptionKeyRepository` → `infrastructure/persistence/supabase-encryption-key.repository.ts` (rename class + implement port)
3. Rename `EncryptionService` → `AesGcmCryptoService`, relocate to `infrastructure/crypto/`. **No logic change.** Just file move + class rename + export update. Tests should still pass with mechanical import path updates.
4. Split high-level flows into 8 use cases (use cases inject `AesGcmCryptoService` for primitives + `EncryptionKeyRepositoryPort` for vault data)
5. Rewire `encryption.controller.ts` to inject use cases instead of `EncryptionService`. Move to `infrastructure/http/`.
6. Migrate tests: split `encryption.service.spec.ts` into per-use-case specs; keep `aes-gcm.crypto-service.spec.ts` for the renamed primitive class. Integration + e2e specs may need import path updates only.

### Acceptance

- [ ] 6 commits
- [ ] All encryption tests pass (≥3128 LOC of test coverage)
- [ ] HTTP contract preserved on all 8 endpoints
- [ ] Controller no longer injects `EncryptionService` directly (or `AesGcmCryptoService` directly) — only use cases
- [ ] `bun run quality` clean
- [ ] `bun run lint:arch` clean

### Stop conditions

- Any encryption test fails after 1 fix attempt → HALT, report to user. Security-critical.
- Crypto round-trip test (`decrypt(encrypt(x)) === x`) fails → HALT, revert.
- Test suite hangs (DEK cache leak between tests) → halt, investigate cache invalidation in test setup.

## Tier 2 final verification (before starting Tier 3)

```bash
cd backend-nest
bun test 2>&1 | tail -3                              # all pass (count may have grown +20-50 from new tests)
bun run quality                                       # 0 errors
bun run lint:arch                                     # 0 errors (still with carve-out)
git log --oneline | head -20                          # ~16 new commits visible
grep -rn "private readonly userService\|private readonly accountDeletionService" backend-nest/src --include="*.ts" | grep -v ".spec.ts"  # 0 results expected (no Service→Service)
```

If any check fails, halt and reconcile before Tier 3.

---

# Tier 3 — Repos Return Entities

## Goal

Repositories decrypt internally and return decrypted domain entities. Use cases lose the `ENCRYPTION_PORT` injection on read paths and most write paths. Mappers move to controller-side (entity → API DTO). Tier 1 carve-out is removed.

This is the textbook Clean Arch fix for the 34 dep-cruiser violations.

## Estimated effort

5 modules × ~5 commits = ~25 commits + 1 finalize commit (remove carve-out, update docs) = **~26 commits**.

## Modules in scope

`budget-line`, `transaction`, `budget`, `budget-template`, `demo`. **NOT** `user`, `account-deletion` (no encryption), **NOT** `encryption` itself (it IS the encryption layer).

## Sequential, NOT parallel

Each module's repo refactor is mostly self-contained, BUT:
- `budget` module's `fetchBudgetData` reads `budget_line` + `transaction` rows for aggregation. Best practice: budget repo does its own decryption for cross-table reads (it injects `ENCRYPTION_PORT`).
- `budget-line` repo's `checkUncheckedTransactions` RPC returns transaction rows — also decrypts internally.

To avoid commit-race issues on the same branch and to allow each module to validate independently, run **sequentially**.

## Pattern (per module, 5 commits)

### Step 0 — Read references

Before each module's Tier 3 migration, read:
- The module's current repo file (`infrastructure/persistence/supabase-<module>.repository.ts`)
- The module's current use cases (`application/*.use-case.ts`)
- The module's mapper (`infrastructure/mappers/<module>.mapper.ts`)
- The previous Tier 3-migrated module (after the first one) for fresh template

### Step 1 — Define the domain entity

`backend-nest/src/modules/<module>/domain/<module>.entity.ts`:
```typescript
// BEFORE — types are DB-row shaped (snake_case, encrypted ciphertexts)
export type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
export type BudgetLineInsert = Database['public']['Tables']['budget_line']['Insert'];

// AFTER — add a domain entity (camelCase, decrypted, plain-typed)
export interface BudgetLine {
  id: string;
  budgetId: string;
  templateLineId: string | null;
  name: string;
  amount: number;             // decrypted
  originalAmount: number | null;  // decrypted
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  isManuallyAdjusted: boolean;
  checkedAt: Date | null;
  // ... currency metadata (camelCase)
  createdAt: Date;
  updatedAt: Date;
}

// Inputs accept plain numbers (repo encrypts internally)
export interface BudgetLineCreateInput {
  budgetId: string;
  templateLineId?: string | null;
  name: string;
  amount: number;             // plain
  originalAmount?: number | null;  // plain
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  // ...
}

export interface BudgetLineUpdatePatch {
  name?: string;
  amount?: number;            // plain
  originalAmount?: number | null;
  // ...
}

// DB row type still exported for repo internal use
export type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
```

### Step 2 — Update repository port

`backend-nest/src/modules/<module>/domain/ports/<module>-repository.port.ts`:
```typescript
export interface BudgetLineRepositoryPort {
  // Returns entities (decrypted)
  findAll(): Promise<BudgetLine[]>;
  findById(id: string): Promise<BudgetLine>;
  findByBudgetId(budgetId: string): Promise<BudgetLine[]>;
  
  // Accepts plain inputs (repo encrypts internally)
  insert(input: BudgetLineCreateInput): Promise<BudgetLine>;
  update(id: string, patch: BudgetLineUpdatePatch): Promise<BudgetLine>;
  
  delete(id: string): Promise<void>;
  
  // RPC methods — return entities
  toggleCheck(id: string): Promise<BudgetLine>;
  checkUncheckedTransactions(id: string): Promise<Transaction[]>;  // imports Transaction from transaction module's domain entity
  
  // Cross-table helpers
  fetchTemplateLineById(templateLineId: string): Promise<TemplateLineEntity | null>;  // returns entity, not row
}
```

### Step 3 — Update repository implementation

`backend-nest/src/modules/<module>/infrastructure/persistence/supabase-<module>.repository.ts`:

```typescript
@Injectable()
export class SupabaseBudgetLineRepository implements BudgetLineRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findAll(): Promise<BudgetLine[]> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const { data, error } = await supabase
      .from('budget_line')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        { operation: 'findAll', userId: user.id },
        { cause: error },
      );
    }
    if (!data?.length) return [];
    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    return data.map(row => this.toEntity(row, dek));
  }

  async insert(input: BudgetLineCreateInput): Promise<BudgetLine> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const { amount: encryptedAmount } = await this.encryption.prepareAmountData(
      input.amount,
      user.id,
      user.clientKey,
    );
    const encryptedOriginal = await this.encryption.encryptOptionalAmount(
      input.originalAmount,
      user.id,
      user.clientKey,
    );
    const { data, error } = await supabase
      .from('budget_line')
      .insert({
        ...this.toRow(input),
        amount: encryptedAmount,
        original_amount: encryptedOriginal,
      })
      .select()
      .single();
    if (error || !data) {
      // Translate Postgres 23505 → ALREADY_EXISTS, etc.
      throw this.translateInsertError(error, user.id, input);
    }
    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    return this.toEntity(data, dek);
  }

  // ... other methods follow the same pattern

  // Mapping helpers (private)
  private toEntity(row: BudgetLineRow, dek: Buffer): BudgetLine {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      templateLineId: decrypted.template_line_id,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      kind: decrypted.kind as TransactionKind,
      recurrence: decrypted.recurrence as TransactionRecurrence,
      isManuallyAdjusted: decrypted.is_manually_adjusted,
      checkedAt: decrypted.checked_at ? new Date(decrypted.checked_at) : null,
      // ... currency metadata
      createdAt: new Date(decrypted.created_at),
      updatedAt: new Date(decrypted.updated_at),
    };
  }

  private toRow(input: BudgetLineCreateInput): Partial<BudgetLineInsert> {
    return {
      budget_id: input.budgetId,
      template_line_id: input.templateLineId ?? null,
      name: input.name,
      kind: input.kind,
      recurrence: input.recurrence,
      // ...
    };
  }
}
```

### Step 4 — Simplify use cases

`backend-nest/src/modules/<module>/application/<verb>-<module>.use-case.ts`:

```typescript
@Injectable()
export class CreateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY) private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT) private readonly budgetRecalc: BudgetRecalculationPort,
    @InjectInfoLogger(CreateBudgetLineUseCase.name) private readonly logger: InfoLogger,
  ) {}

  async execute(input: BudgetLineCreate): Promise<BudgetLine> {
    BudgetLineInvariants.validateCreate(input);
    const enriched = await this.currencyService.overrideExchangeRate(input);
    const entity = await this.repo.insert(enriched);
    await this.budgetRecalc.recalculate(entity.budgetId);
    const user = this.repo['supabaseProvider'].user;  // OR have provider injected here too
    await this.cacheService.invalidateForUser(user.id);
    this.logger.info(
      { budgetLineId: entity.id, userId: user.id, operation: 'budgetLine.create' },
      'Budget line created',
    );
    return entity;  // returns ENTITY, not API DTO
  }
}
```

NB: use case **returns the entity**, not the wrapped API response. Controller does the mapping.

### Step 5 — Move mapper concern to controller

Mappers stay in `infrastructure/mappers/` (correct location architecturally). Controllers inject the mapper (controllers ARE infrastructure, no rule violation).

`backend-nest/src/modules/<module>/infrastructure/http/<module>.controller.ts`:

```typescript
@Controller({ path: 'budget-lines', version: '1' })
@UseGuards(AuthGuard)
export class BudgetLineController {
  constructor(
    private readonly createBudgetLine: CreateBudgetLineUseCase,
    private readonly findAll: FindAllBudgetLinesUseCase,
    // ... other use cases
    private readonly mapper: BudgetLineMapper,  // controller injects mapper directly
  ) {}

  @Post()
  async create(@Body() dto: BudgetLineCreateDto): Promise<BudgetLineResponse> {
    const entity = await this.createBudgetLine.execute(dto);
    return { success: true, data: this.mapper.toApi(entity) };
  }
}
```

`BudgetLineMapper.toApi()` now operates on **entities**, not on `Row` types. Update its signature:
```typescript
@Injectable()
export class BudgetLineMapper {
  toApi(entity: BudgetLine): BudgetLineApiDto {
    return {
      id: entity.id,
      budgetId: entity.budgetId,
      amount: entity.amount,
      // ... pass through (already camelCase)
    };
  }
}
```

The Row → Entity mapping moves into the **repository** (Step 3 above). The mapper now does Entity → API DTO only.

### Per-module sequential commits (5)

1. `refactor(backend): add <module> domain entity types and update port to return entities`
   - New entity types in `domain/<module>.entity.ts`
   - Port interface updated
   - Repo and use cases NOT YET updated — will fail to typecheck on those files. Fix in next 2 commits.
   - **NB:** This commit may temporarily break compilation. Either skip this commit and merge into commit 2, OR keep the old port export alongside the new for one commit. Practical: merge steps 1+2 into one commit.

2. `refactor(backend): <module> repo decrypts internally and returns entities`
   - Repo impl updated to decrypt + map to entity in reads, encrypt in writes
   - Repo injects ENCRYPTION_PORT
   - Repo `.spec.ts` updated to mock ENCRYPTION_PORT

3. `refactor(backend): <module> use cases drop ENCRYPTION_PORT injection and work with entities`
   - All use cases simplified
   - Use case `.spec.ts` files updated (no longer mock ENCRYPTION_PORT)
   - Use cases return entities, not API DTOs

4. `refactor(backend): <module> controller maps entities to API DTOs`
   - Controller injects mapper
   - Mapper `toApi` operates on entities (not rows)
   - Update mapper signature + spec

5. `refactor(backend): cleanup <module> imports and remove dead encrypt/decrypt code paths`
   - Remove unused `EncryptionPort` injections
   - Remove inline decryption helpers in use cases (now dead)
   - Remove unused `Row` type imports in use case files
   - Update barrel `index.ts` if needed

### Quality gates per commit

```bash
cd backend-nest
bun test src/modules/<module>          # ALL pass for that module
bun test                                # FULL suite — many cross-module impacts
bun run quality                         # 0 errors
bun run lint:arch                       # 0 errors with Tier 1 carve-out (Tier 3 doesn't remove yet)
```

### Acceptance per module

- [ ] 5 commits on branch
- [ ] Repo signature returns entity types (not Row types)
- [ ] All use cases compile WITHOUT importing ENCRYPTION_PORT (write-side may keep it for cross-table encryption — `reset-from-template` needs to decrypt template_line)
- [ ] Mapper `.toApi(entity)` consumes entity types
- [ ] Use case `.spec.ts` files don't mock ENCRYPTION_PORT (read paths) — write paths may still need to mock for the `prepareAmountData` calls if any remain
- [ ] Controller endpoints return identical response shape (frontend contract preserved)
- [ ] All tests pass
- [ ] `bun run quality` clean
- [ ] `bun run lint:arch` clean

### Per-module specifics

#### Tier 3 — `budget-line` (run first)

- 9 use cases simplify
- `reset-from-template` use case may still need `EncryptionPort` to decrypt the template_line amount (cross-table read) — UNLESS the repo's `fetchTemplateLineById` returns a decrypted entity. Recommended: **YES**, repo returns decrypted `TemplateLineEntity`. Then use case is fully entity-only.
- `check-transactions` use case calls RPC that returns transaction rows — repo decrypts before returning.
- ~5 commits.

#### Tier 3 — `transaction` (run second)

- 9 use cases simplify
- `search-transactions` use case is the trickiest — orchestrates 3 repo methods + cross-table results (transactions + budget_lines). Repo decrypts both sides before returning. Use case combines into the search response shape.
- ~5 commits.

#### Tier 3 — `budget` (run third)

- 11 use cases simplify
- `find-budget-with-details` use case uses cache.getOrSet — entity is the cached value (must be JSON-serializable; `Date` fields must be ISO strings or `Date` — check Pino+CacheManager handling).
- `recalculate-budget-balances` use case: BudgetCalculator (now `budget.formulas.ts` pure functions) operates on decrypted numbers. Repo's `fetchBudgetData` returns entities; formulas compute new ending_balance; repo's `persistEndingBalance(budgetId, newBalance)` accepts plain number, encrypts internally.
- `export-all-budgets` use case: enrichments stay simple — repo returns enriched entities or use case stitches.
- ~5 commits.

#### Tier 3 — `budget-template` (run fourth)

- 13 use cases simplify
- `bulk-template-line-operations` use case: orchestrates a complex RPC. The RPC payload schemas (Zod, in `infrastructure/persistence/schemas/rpc-payload.schemas.ts`) accept ciphertext strings. The repo method that invokes the RPC **encrypts the entity inputs** before calling the RPC, and **decrypts results** before returning entities to the use case.
- ~5 commits.

#### Tier 3 — `demo` (run fifth) + Tier 1 carve-out removal

- DemoRepository's seed methods accept entity-shaped data (plain numbers); repo encrypts internally with `DEMO_CLIENT_KEY_BUFFER`.
- `demo-template-specs.ts` (pure data) returns plain numbers. Repo encrypts at insert time.
- `generate-demo-data.use-case` simplifies — no inline encryption.
- `cleanup` use cases unaffected (no encryption).
- ~5 commits.

After demo is done, **finalize**:

6. `chore(backend): remove dep-cruiser carve-out for application→infrastructure/mappers`

   - Verify use cases no longer import from `infrastructure/mappers/`:
     ```bash
     grep -rn "from.*infrastructure/mappers" backend-nest/src/modules/*/application
     ```
     Expected: 0 results.
   - If non-zero: file follow-up issue, leave carve-out documented + skip this commit.
   - If zero: remove the `pathNot` clause from `.dependency-cruiser.cjs`. Run `bun run lint:arch` — must be 0 errors without carve-out.
   - Update `backend-nest/docs/ARCHITECTURE.md`:
     - Add section "Repos return decrypted entities"
     - Update layer-responsibility table: domain entities are decrypted; infrastructure repos handle encryption boundary
     - Note that `ENCRYPTION_PORT` is now consumed by repos, not use cases (mostly)
   - Commit:
     ```bash
     git add backend-nest/.dependency-cruiser.cjs backend-nest/docs/ARCHITECTURE.md
     git commit -m "chore(backend): remove dep-cruiser carve-out — repos now return entities" \
       -m "Tier 3 complete. Use cases no longer import from infrastructure/mappers/. Mappers (entity → API DTO) live in infrastructure/http/ and are injected by controllers."
     ```

## Tier 3 final verification

```bash
cd backend-nest

# 0 use case imports of mapper
grep -rn "from.*infrastructure/mappers" src/modules/*/application
# Expected: 0 results (or zero from the 5 fully-migrated modules; user/account-deletion/encryption may not have mappers in this sense)

# 0 use case injections of ENCRYPTION_PORT (read-side)
grep -rn "@Inject(ENCRYPTION_PORT)" src/modules/{budget,budget-line,transaction,budget-template,demo}/application
# Expected: only writes that need it (reset-from-template MAY have it, or may not after repo handles it)

# repos inject ENCRYPTION_PORT
grep -l "@Inject(ENCRYPTION_PORT)" src/modules/*/infrastructure/persistence/*.ts
# Expected: budget-line, transaction, budget, budget-template, demo

# All tests
bun test 2>&1 | tail -3                  # all pass
bun run quality                          # 0 errors
bun run lint:arch                        # 0 errors WITHOUT carve-out
```

## Tier 3 stop conditions

- A repo refactor breaks > 5 tests at once → halt, investigate, fix incrementally.
- Cache.getOrSet serialization breaks (Date / Buffer in entity not serializable) → use ISO strings in entities, OR use cache only for raw data.
- `recalculate-budget-balances` produces different numerical results post-refactor → halt, this is a correctness bug. Compare with snapshot.

---

# Final Acceptance Criteria (all 3 tiers)

End state checklist after Tier 3 finalize commit:

- [ ] **Tier 1**: dep-cruiser carve-out added then removed (commits visible in git log)
- [ ] **Tier 2**: 3 modules (account-deletion, user, encryption) migrated to 3-layer
- [ ] **Tier 3**: 5 modules (budget-line, transaction, budget, budget-template, demo) repos return entities
- [ ] No `EncryptionService` import outside `encryption/` module
- [ ] No `BudgetService` direct import anywhere (already true after Phase 5)
- [ ] No `private readonly userService` / `private readonly accountDeletionService` cross-module Service→Service injections
- [ ] All repos returning entities inject `AuthenticatedSupabaseProvider` + `ENCRYPTION_PORT`
- [ ] Use cases in budget/budget-line/transaction/budget-template/demo don't inject `ENCRYPTION_PORT` for read paths
- [ ] Use cases return entities, controllers wrap in API response shape via mapper
- [ ] `bun run lint:arch` passes 0 errors **without** carve-out
- [ ] Full test suite passes
- [ ] `bun run quality` clean
- [ ] `backend-nest/docs/ARCHITECTURE.md` reflects entity-returning repos
- [ ] No `--no-verify` in commit history
- [ ] Webapp budget CRUD smoke test passes (manual)

# Estimated total commits

- Tier 1: 1
- Tier 2A: 5
- Tier 2B: 5
- Tier 2C: 6
- Tier 3 × 5 modules: 25
- Tier 3 finalize: 1
- **Total: 43 new commits**

End state: ~86 total commits on `neogenz/marseille` (43 from previous session + 43 from these tiers).

# Pitfalls observed in previous session

- **Commit bundling under parallel agents.** Phase 0 had 5 agents commit on the same branch — pre-commit hooks ran repo-wide, blocked individual agents until peers' work was clean, ended up with multi-task commits. Mitigation: run sequentially within a tier, OR have agents stage but defer commits to a coordinator.
- **Context compaction confusing agents.** A budget-refactor agent's context got compacted mid-task; on resume it didn't realize work was uncommitted. Mitigation: agents should ALWAYS verify state with `git status --short` and `git log --oneline -1` before claiming completion.
- **Stale messages from compacted agents.** They keep arriving as `idle_notification` after task is done. Ignore them.
- **`TaskList` resets when team is recreated.** If teams_mode is used and team gets cleaned up, tasks vanish. Either re-create tasks OR pass full context in agent prompts (preferred — fewer moving parts).
- **CLS context not auto-imported in test TestingModules.** Phase 4 broke `account-deletion.integration.spec` because TestingModule didn't include `ClsModule`. Already fixed by importing `ClsModule` in `SupabaseModule`. Be aware for new test setups.

# How to run this plan with a fresh agent

Recommended invocation (next session):

```
/apex -a -x -m # Backend Clean Arch tiers — read backend-nest/docs/CLEAN_ARCH_TIER_PLAN.md and execute Tier 1, then Tier 2 (sequential sub-tiers), then Tier 3 (sequential modules), then finalize.
```

Or, if you want strict step-gates:

```
/apex -a -x # Read backend-nest/docs/CLEAN_ARCH_TIER_PLAN.md and execute Tier 1 only. Halt for review.
```

After Tier 1: `/apex -a -x` for Tier 2. After Tier 2: `/apex -a -x` for Tier 3.

# References

- Project arch overview: `backend-nest/docs/ARCHITECTURE.md`
- Encryption rules: `.claude/rules/05-workflows-and-processes/encryption-backend.md`
- Error handling: `.claude/rules/05-workflows-and-processes/error-handling-backend.md`
- NestJS conventions (post-Phase 6): `.claude/rules/00-architecture/nestjs-architecture.md`
- Project root rules: `CLAUDE.md`
- Encryption split-key design: `docs/ENCRYPTION.md`

---

**Start here:** Tier 1 first (1 commit, ~10 minutes, low risk). Don't skip.
