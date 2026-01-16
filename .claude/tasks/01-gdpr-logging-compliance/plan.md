# Implementation Plan: GDPR Logging Compliance (Option A)

## Overview

Implement GDPR-compliant logging with minimal changes:
1. **Anonymize IP addresses** in HTTP logs (e.g., `192.168.1.100` → `192.168.x.x`)
2. **Simplify User-Agent** to device type only (`mobile`, `tablet`, `desktop`)
3. **Remove `endingBalance`** from business logs (financial data)

**Approach**: Modify the existing production serializers in `app.module.ts` and remove sensitive data from business logs.

## Dependencies

No external dependencies. Changes use existing Pino infrastructure.

**Order of changes**:
1. `app.module.ts` - Core serializer changes (must be first)
2. `budget.calculator.ts` - Remove financial data from logs
3. `LOGGING.md` - Document GDPR guidelines
4. Tests - Add unit tests for anonymization functions

---

## File Changes

### `backend-nest/src/app.module.ts`

**Location**: Lines 153-171 (`createProductionSerializers` function)

- **Add helper function `anonymizeIp`** before `createProductionSerializers`:
  - Accept `string | undefined` parameter
  - Return `undefined` if input is falsy
  - For IPv4 (4 parts separated by `.`): return first 2 octets + `.x.x`
  - For IPv6 (contains `:`): return first 2 segments + `::x`
  - Otherwise return `[IP_REDACTED]`

- **Add helper function `parseDeviceType`** before `createProductionSerializers`:
  - Accept `string | undefined` parameter
  - Return `'unknown'` if input is falsy
  - Convert to lowercase and check for keywords:
    - Contains `'mobile'`, `'android'`, `'iphone'` → return `'mobile'`
    - Contains `'tablet'`, `'ipad'` → return `'tablet'`
    - Otherwise → return `'desktop'`

- **Modify `createProductionSerializers`** (lines 164-165):
  - Change line 164: Replace `req.headers?.['user-agent']` with `parseDeviceType(req.headers?.['user-agent'])`
  - Change line 165: Replace raw IP extraction with `anonymizeIp(req.headers?.['x-forwarded-for'] as string || req.headers?.['x-real-ip'] as string)`
  - Rename field from `userAgent` to `deviceType` for clarity

---

### `backend-nest/src/modules/budget/budget.calculator.ts`

**Location**: Lines 194-201 (`persistEndingBalance` method)

- **Remove `endingBalance` from log context** (line 197):
  - Remove the `endingBalance` property from the log object
  - Keep `budgetId` and `operation` fields
  - The log should only contain: `{ budgetId, operation: 'balance.recalculated' }`

- **Consider**: The message already describes the action, the budgetId provides traceability without exposing financial data

---

### `backend-nest/LOGGING.md`

**Location**: After section "🔒 Sécurité et Redaction" (around line 180)

- **Add new subsection "### GDPR Compliance"**:
  - Explain that IP addresses are anonymized (partial masking)
  - Explain that User-Agent is simplified to device type
  - List data that should NEVER be logged:
    - Raw IP addresses
    - Full User-Agent strings
    - Financial amounts (balances, transaction values)
    - Personal identifiers beyond UUIDs

- **Update example in "Guard Authentication"** section (lines 329-340):
  - Change `ip: req.ip` to note that IP is auto-anonymized by serializer
  - Change `userAgent: req.headers['user-agent']` to note that device type is used

---

## Testing Strategy

### Tests to Create: `backend-nest/src/common/utils/log-anonymization.spec.ts`

- **Test `anonymizeIp` function**:
  - IPv4 address → returns first 2 octets + `.x.x`
  - IPv6 address → returns first 2 segments + `::x`
  - `undefined` input → returns `undefined`
  - Empty string → returns `undefined`
  - Invalid format → returns `[IP_REDACTED]`

- **Test `parseDeviceType` function**:
  - Mobile user agents (iPhone, Android) → returns `'mobile'`
  - Tablet user agents (iPad) → returns `'tablet'`
  - Desktop user agents (Chrome, Firefox) → returns `'desktop'`
  - `undefined` input → returns `'unknown'`
  - Empty string → returns `'unknown'`

### Manual Verification Steps

1. Start the backend in development mode: `bun run dev`
2. Make an HTTP request and verify logs show:
   - `deviceType: 'desktop'` (or mobile/tablet) instead of full User-Agent
   - `ip: '192.168.x.x'` format instead of full IP
3. Trigger a balance recalculation and verify `endingBalance` is NOT in logs
4. Run `bun run quality` to ensure no type errors

---

## Documentation

- **Update**: `backend-nest/LOGGING.md` - Add GDPR compliance section
- **No new docs needed**: Changes are internal implementation details

---

## Rollout Considerations

### Breaking Changes
- **None**: Log format changes are non-breaking for downstream systems
- Log field `userAgent` renamed to `deviceType` - update any log queries if needed

### Migration Steps
1. Deploy changes to production
2. Verify logs in Railway show anonymized format
3. Update any log monitoring/alerting queries that rely on `userAgent` field name

### Feature Flags
- **Not needed**: Changes are safe to deploy directly

### Verification After Deployment
- Check Railway production logs for:
  - IP format: `"ip":"192.168.x.x"` (anonymized)
  - Device type: `"deviceType":"mobile"` (simplified)
  - No `endingBalance` in business logs
