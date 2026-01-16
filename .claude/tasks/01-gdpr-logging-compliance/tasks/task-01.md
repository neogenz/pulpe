# Task: IP and User-Agent Anonymization in HTTP Logs

## Problem

HTTP request logs currently capture full IP addresses and complete User-Agent strings. Under GDPR, these are considered personal data:
- **IP addresses**: Can identify individuals, especially when combined with timestamps
- **User-Agent strings**: Contain detailed browser/device fingerprinting data

We need to anonymize this data while preserving enough information for debugging and analytics.

## Proposed Solution

1. Create helper functions to anonymize sensitive HTTP data:
   - `anonymizeIp`: Mask last octets of IP addresses (IPv4: `192.168.x.x`, IPv6: `2001:db8::x`)
   - `parseDeviceType`: Convert User-Agent to simple device category (`mobile`, `tablet`, `desktop`)

2. Integrate these functions into the production request serializer

3. Add unit tests to verify anonymization behavior

## Dependencies

- None (can start immediately)

## Context

- **Target file**: `backend-nest/src/app.module.ts:153-171` (`createProductionSerializers` function)
- **Current behavior**: Lines 164-165 log raw `user-agent` header and IP from `x-forwarded-for` or `x-real-ip`
- **Field rename**: Change `userAgent` field to `deviceType` for clarity
- **Test location**: Create `backend-nest/src/common/utils/log-anonymization.spec.ts`

## Success Criteria

- IPv4 addresses logged as `X.X.x.x` format (first 2 octets preserved)
- IPv6 addresses logged as first 2 segments + `::x`
- User-Agent replaced with device type: `mobile`, `tablet`, `desktop`, or `unknown`
- Unit tests pass for:
  - Valid IPv4/IPv6 anonymization
  - Edge cases (undefined, empty string, invalid format)
  - Device type detection for various User-Agent patterns
- `pnpm quality` passes
