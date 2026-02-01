# Step 03: Execute

**Task:** Fix both blocking issues from code review: random placeholder key in getSalt and plaintext sessionStorage persistence
**Started:** 2026-02-01T10:01:48Z

---

## Implementation Log

### Blocking #1: Replace random placeholder key with sentinel constant

#### `encryption-api.ts`
- Removed `generateRandomKeyHex` import
- Added `SALT_REQUEST_PLACEHOLDER_KEY` constant (`'0'.repeat(63) + '1'`) with explanatory comment
- Replaced `generateRandomKeyHex()` call with `SALT_REQUEST_PLACEHOLDER_KEY`
- Removed stale inline comment (logic now explained at constant definition)

#### `encryption-api.spec.ts`
- Removed `vi.mock('./crypto.utils')` block (no longer needed)
- Updated assertion to expect the sentinel value `'0'.repeat(63) + '1'`

#### `index.ts`
- Removed `generateRandomKeyHex` from barrel export (no external consumers)

### Blocking #2: Document sessionStorage trade-off

#### `docs/ENCRYPTION.md`
- Updated clientKey storage description from "Jamais stocke" to accurate sessionStorage description
- Added new "Stockage du clientKey" section documenting:
  - sessionStorage properties (tab-scoped, cleared on close/logout)
  - Accepted XSS risk with mitigations (CSP, split-key, interceptability of password)
  - Rejected alternative (in-memory only = re-auth on every reload)

---

## Validation
- **Tests:** 79 files, 1020 tests, all passing
- **No functional behavior change** for users

## Step Complete
**Status:** Complete
**Files modified:** 4
**Next:** step-04-validate.md
