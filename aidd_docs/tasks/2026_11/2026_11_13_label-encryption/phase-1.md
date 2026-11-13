---
status: pending
---

# Instruction: Stale key lands on the PIN screen

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── backend-nest/
│   └── src/
│       └── modules/
│           └── encryption/
│               ├── encryption.e2e.spec.ts ✏️
│               └── infrastructure/
│                   └── crypto/
│                       ├── aes-gcm.crypto-service.ts ✏️
│                       └── aes-gcm.crypto-service.spec.ts ✏️
├── frontend/
│   └── projects/
│       └── webapp/
│           └── src/
│               └── app/
│                   └── core/
│                       └── encryption/
│                           ├── client-key.interceptor.ts ✏️
│                           └── client-key.interceptor.spec.ts ✏️
└── docs/
    └── ENCRYPTION.md ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Local Supabase up (started from the main repo), seed account with a vault; change its PIN from a second session so the first one holds a stale key | One session with a valid key, one with a stale key | system |
| Happy path | `GET` an endpoint that decrypts, with the stale `X-Client-Key` | 400 `ERR_ENCRYPTION_KEY_CHECK_FAILED`, where it answered 200 with zero amounts | api |
| Happy path | In the web tab holding the stale key, open a budget | The stored key is cleared and the PIN screen shows; after the new PIN the budget loads with its amounts | browser |
| Edge case  | Stale key on a write from the web (edit a budget line) | Same landing on the PIN screen instead of a generic error | browser |
| Edge case  | Account whose `user_encryption_key.key_check` is null reads with any key | Unchanged: the derived key is returned uncached, no 400 | api |
| Edge case  | Wrong PIN typed in the change-PIN dialog while a valid key is stored | Inline error in the dialog, stored key kept, no navigation | browser |
| Edge case  | Wrong PIN typed on the assistant consent page, whose request carries its own `X-Client-Key` | Inline error, no navigation | browser |
| Edge case  | `POST /encryption/setup-recovery` answers the code for an account with no key row, which is not a stale key | That screen's own error, stored key kept, no navigation | browser |
| Edge case  | Key-check failure while already on the PIN screen | No navigation loop | browser |
| Edge case  | Valid key | No behaviour change; the key enters the cache only after the canary check | api |
| Teardown   | `bun run supabase:reset` | Seed restored | system |

## Tasks to do

### `1)` Refuse a stale key on reads

> A request that derives a key the canary rejects stops there.

1. `aes-gcm.crypto-service.ts`, `getUserDEK`: when `row.key_check` exists and `validateKeyCheck` fails, throw `ENCRYPTION_KEY_CHECK_FAILED` with `{ userId, operation }`; keep returning the uncached key when `key_check` is null; rewrite the invariant comment. `getDekFor` is its only caller outside specs.
2. `aes-gcm.crypto-service.spec.ts`: flip the cases that expect an unverified key back when a canary exists (the `getUserDEK` block and the old-key cases after a rekey); keep the null-canary case.
3. `encryption.e2e.spec.ts`: after the change-PIN flow, a `GET` that decrypts with the old key answers 400 with the code.
4. Grep the other specs for reads that rely on the zero fallback with a wrong key and align them. The per-row fallback of `tryDecryptAmount` stays: it now only covers an isolated unreadable row.

### `2)` Send the web to the PIN screen

> The web reacts to the code the way iOS and Android already do.

1. `client-key.interceptor.ts`: on a request where it injected the stored key, catch a `400` whose body code is `ERR_ENCRYPTION_KEY_CHECK_FAILED`, call `ClientKeyService.clear()`, navigate to `ROUTES.ENTER_VAULT_CODE` unless the router is already there, then rethrow.
2. Leave alone every `/encryption/` request: `validate-key`, `change-pin`, `recover` and `verify-recovery-key` carry a typed key and show their own error, and `setup-recovery` and `regenerate-recovery`, which use the stored key, can answer the code for a reason other than a stale key (no key row, or a first setup over existing data). A request that already carries `X-Client-Key` is not touched, as today.
3. `client-key.interceptor.spec.ts`: landing on a read and on a write; no landing for an `/encryption/` request, for a request with its own header, and when already on the PIN route.
4. `auth-interceptor.ts` keeps passing the code through: its spec case on `/encryption/validate-key` stays true.

### `3)` Check the installed mobile builds before the server ships

> Know which installed build cannot handle the 400, since no setting can keep it out.

1. Android: the handler and the version gate both arrive with the first Expo build (commit `e2ed93d0f`, 2026-08-21), so every build of the Expo app handles the code.
2. iOS: the handler ships since `033198e10` (2026-02-18), the version gate only since `01c460c0c` (2026-05-14). The gate runs in the app, so a build older than the handler ignores `MIN_IOS_VERSION`: raising it keeps nobody out. Read in App Store Connect whether a build uploaded before 2026-02-18 still has active devices.
3. On such a build a stale key gives a load error where it gave zero amounts. Accept that in the pull request, or hold the server change until those devices are gone.

### `4)` Document the behaviour

> The reference doc says what a stale key does.

1. `docs/ENCRYPTION.md`: a stale key is refused on reads as on writes, and the three clients land on the PIN screen.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | A read with a stale key answers 400 `ERR_ENCRYPTION_KEY_CHECK_FAILED`; the null-canary read and every valid-key case stay green |
| 2    | The interceptor spec passes its five cases; in the browser the stale tab ends on the PIN screen and recovers with the new PIN |
| 3    | The pull request states whether an iOS build older than the handler still has active devices, and the decision taken for it |
| 4    | `docs/ENCRYPTION.md` describes the stale-key path |
