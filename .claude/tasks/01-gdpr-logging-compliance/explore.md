# Task: GDPR Logging Compliance - Anonymize Sensitive Data

## Summary

Implement GDPR-compliant logging by:
1. Anonymizing IP addresses (partial masking)
2. Removing `endingBalance` from logs (financial data)
3. Simplifying User-Agent to device type only

---

## Codebase Context

### Logging Infrastructure

| Component | Path | Purpose |
|-----------|------|---------|
| Pino Config | `backend-nest/src/app.module.ts:173-216` | Central logger configuration with HTTP-level redaction |
| Production Serializers | `backend-nest/src/app.module.ts:153-171` | Logs IP and User-Agent for ALL HTTP requests |
| Global Exception Filter | `backend-nest/src/common/filters/global-exception.filter.ts` | Application-level redaction for error logs |
| Budget Calculator | `backend-nest/src/modules/budget/budget.calculator.ts:194-201` | Logs `endingBalance` financial data |
| Logging Docs | `backend-nest/LOGGING.md` | Documentation of logging standards |
| Redaction Tests | `backend-nest/src/test/redaction.integration.spec.ts` | Tests documenting redaction behavior |

### Current Redaction Configuration

**HTTP-Level (app.module.ts:182-193):**
```typescript
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.token',
    'res.headers["set-cookie"]'
  ],
  censor: '[Redacted]'
}
```

**Application-Level (global-exception.filter.ts:308-314):**
```typescript
sensitiveFields = ['password', 'token', 'secret', 'authorization', 'auth']
```

### Where Sensitive Data is Logged

#### 1. IP Address (`app.module.ts:165`)
```typescript
ip: req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip']
```
- Logged for ALL HTTP requests in production
- No anonymization applied

#### 2. User-Agent (`app.module.ts:164`)
```typescript
userAgent: req.headers?.['user-agent']
```
- Full User-Agent string logged for ALL HTTP requests
- Contains browser, OS, device info (fingerprinting risk)

#### 3. endingBalance (`budget.calculator.ts:194-201`)
```typescript
this.logger.info(
  {
    budgetId,
    endingBalance,  // SENSITIVE FINANCIAL DATA
    operation: 'balance.recalculated',
  },
  'Balance de fin de mois recalculée et persistée',
);
```

---

## Documentation Insights

### Pino Redaction Options

**Path-based redaction:**
```typescript
redact: {
  paths: ['req.ip', 'user.ipAddress'],
  censor: (value) => {
    // IPv4: 192.168.1.100 → 192.168.x.x
    const match = value.match(/^(\d+\.\d+)\.\d+\.\d+$/);
    return match ? `${match[1]}.x.x` : '[Redacted]';
  }
}
```

**Custom serializers for HTTP:**
```typescript
serializers: {
  req(request) {
    return {
      method: request.method,
      url: request.url,
      ip: anonymizeIp(request.ip),
      userAgent: parseDeviceType(request.headers['user-agent'])
    };
  }
}
```

### NestJS Logging Best Practices

1. **Centralized redaction service** - Single source of truth for masking
2. **Layered approach** - Apply at middleware, serializer, and service levels
3. **Environment-based verbosity** - Already implemented with `isDevelopment()` checks

---

## Research Findings (GDPR Compliance)

### IP Addresses Under GDPR

- **Status**: Personal data under GDPR (ECJ ruling confirms)
- **Last octet masking is INSUFFICIENT** - Data protection authorities rule truncated IPs remain personal data
- **Recommended**: HMAC-based pseudonymization or full removal

### Retention Periods

| Log Type | Recommended |
|----------|-------------|
| Debug logs | 7-14 days |
| Error logs | 30-60 days |
| Access logs | 90-180 days |
| Security events | 12-24 months |

### What NOT to Log

- Raw IP addresses
- Full User-Agent strings (if not essential)
- Financial data (amounts, balances)
- Session tokens, credentials

---

## Key Files to Modify

| File | Line | Change Required |
|------|------|-----------------|
| `backend-nest/src/app.module.ts` | 164-165 | Anonymize IP, simplify User-Agent in `createProductionSerializers()` |
| `backend-nest/src/app.module.ts` | 182-193 | Add `req.ip` to redaction paths |
| `backend-nest/src/modules/budget/budget.calculator.ts` | 194-201 | Remove `endingBalance` from log context |
| `backend-nest/LOGGING.md` | - | Update documentation with GDPR guidelines |

---

## Patterns to Follow

### Existing Patterns

1. **Pino injection**: `@InjectPinoLogger(ServiceName.name)`
2. **Log structure**: `{ operation, userId?, entityId?, ... }, "English message"`
3. **Environment checks**: `isDevelopment()` for conditional logging
4. **Redaction paths**: Dot notation for nested fields

### Implementation Pattern for IP Anonymization

```typescript
function anonymizeIp(ip: string | undefined): string {
  if (!ip) return undefined;

  // IPv4: 192.168.1.100 → 192.168.x.x
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }

  // IPv6: truncate
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 2).join(':') + '::x';
  }

  return '[IP_REDACTED]';
}
```

### Implementation Pattern for User-Agent Simplification

```typescript
function parseDeviceType(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}
```

---

## Dependencies

- `pino@9.7.0` - Supports custom serializers and redaction paths
- `nestjs-pino@4.4.0` - NestJS integration
- `pino-http@10.5.0` - HTTP logging middleware

No new dependencies required.

---

## Implementation Recommendations

### Option A: Minimal Changes (Recommended)

1. Modify `createProductionSerializers()` to anonymize IP and simplify User-Agent
2. Remove `endingBalance` from `budget.calculator.ts` log
3. Update `LOGGING.md` documentation

**Pros**: Simple, non-breaking, follows existing patterns
**Cons**: IP still logged (anonymized)

### Option B: Complete IP Removal

1. Remove IP from production serializers entirely
2. Remove User-Agent or keep only device type
3. Remove all financial data from logs

**Pros**: Maximum GDPR compliance
**Cons**: Loses some debugging capability

### Option C: HMAC Pseudonymization

1. Hash IP addresses with secret key
2. Keep User-Agent as device type
3. Remove financial data

**Pros**: Allows correlation for debugging without storing raw IPs
**Cons**: More complex, requires key management

---

## Next Steps

1. Run `/epct:plan 01-gdpr-logging-compliance` to create implementation plan
2. Choose between Option A, B, or C based on requirements
