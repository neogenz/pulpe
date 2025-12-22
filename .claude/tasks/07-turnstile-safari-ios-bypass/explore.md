# Task: Turnstile Safari iOS Bypass

## Problem Statement

Le backend NestJS rejette les tokens Turnstile vides en production/preview (403), mais le frontend envoie intentionnellement un token vide pour Safari iOS car Turnstile ne fonctionne pas sur ce navigateur. Le frontend a un commentaire "Protection maintained via backend rate limiting (30 req/h/IP)" qui indique que le backend devrait accepter le token vide.

**Impact**: ~50% des utilisateurs mobiles (Safari iOS) ne peuvent pas utiliser le mode démo.

## Codebase Context

### Frontend - Bypass Mechanisms (welcome.ts)

Le frontend a **4 mécanismes de bypass**, tous envoient un token vide `''`:

1. **E2E Test Bypass** (L259-266): Vérifie `window.__E2E_DEMO_BYPASS__`
2. **Local Environment Bypass** (L270-274): Skip si `!shouldUseTurnstile()` (isLocal)
3. **Safari iOS Bypass** (L276-282):
   ```typescript
   // Safari iOS bypass - Turnstile cross-origin communication is blocked
   // Protection maintained via backend rate limiting (30 req/h/IP)
   if (this.#isSafariIOS()) {
     this.#logger.info('Safari iOS detected, bypassing Turnstile');
     await this.#startDemoWithToken('');
     return;
   }
   ```
4. **Timeout Bypass** (L285-287, L343-354): Si Turnstile ne répond pas en 5s

**Détection Safari iOS** (L327-341):
```typescript
#isSafariIOS(): boolean {
  const ua = navigator.userAgent;
  const isTouchCapable = 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && isTouchCapable);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}
```

### Backend - Token Verification (turnstile.service.ts)

**Le bug est ici** (L45-55):
```typescript
async verify(token: string, ip?: string): Promise<boolean> {
  // Skip in non-production environments
  if (this.skipVerification) {  // ← true seulement pour local/dev/test
    return true;
  }

  if (!token) {  // ← REJETTE le token vide en production/preview!
    this.logger.warn('Missing Turnstile token');
    return false;
  }
  // ... Cloudflare API call
}
```

**skipVerification** est défini par `isProductionLike()` (L29):
```typescript
this.skipVerification = !isProductionLike(nodeEnv);
```

**isProductionLike** (environment.ts L61-68):
```typescript
const PRODUCTION_LIKE_ENVIRONMENTS = ['production', 'preview'] as const;
export const isProductionLike = (value?: string): boolean => {
  return PRODUCTION_LIKE_ENVIRONMENTS.includes(candidate as ProductionLike);
};
```

### Rate Limiting (Protection Alternative)

**Configuration** (app.module.ts L250-261):
```typescript
{
  name: 'demo',
  limit: isDev ? 1000 : 30,  // 30 req/hour en production
  ttl: 3600000,
  skipIf: (context) => !context.switchToHttp().getRequest().url.startsWith('/api/v1/demo'),
}
```

**Appliqué sur le controller** (demo.controller.ts L59):
```typescript
@Throttle({ demo: { limit: 30, ttl: 3600000 } }) // 30 req/hour
```

**IP-based throttling** pour endpoints publics via `UserThrottlerGuard` (user-throttler.guard.ts L163-169).

## Research Findings

### Safari iOS + Turnstile Issues (Confirmed)

Les recherches web confirment que Turnstile a des **problèmes connus et documentés** sur Safari iOS:

1. **ITP (Intelligent Tracking Prevention)** bloque le cookie `cf_clearance`
2. **Cross-origin communication** bloquée → erreurs 401
3. **50% de taux d'échec** rapporté sur Wi-Fi
4. **Boucles infinies** de vérification sur Safari 16+

**Solutions recommandées par la communauté**:
- ✅ Rate limiting comme protection secondaire (déjà implémenté!)
- Private Access Tokens (PAT) pour iOS/macOS
- Bypass conditionnel pour Safari iOS

**Sources**:
- [Cloudflare Community - Safari ITP Causes Verification Loop](https://community.cloudflare.com/t/safari-verify-you-are-human-loop-caused-by-prevent-cross-site-tracking-itp/853297)
- [Cloudflare Community - Unable to Pass Challenge in iOS Safari](https://community.cloudflare.com/t/unable-to-pass-the-challenge-in-ios-safari/650837)

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/.../welcome.ts` | 276-282 | Safari iOS bypass (envoie token vide) |
| `frontend/.../welcome.ts` | 327-341 | Détection Safari iOS |
| `backend-nest/.../turnstile.service.ts` | 52-55 | **BUG: Rejette token vide** |
| `backend-nest/.../environment.ts` | 61-68 | `isProductionLike()` definition |
| `backend-nest/.../demo.controller.ts` | 59 | Rate limiting (30 req/h) |
| `backend-nest/.../app.module.ts` | 250-261 | Throttler configuration |

## Root Cause

**Incohérence frontend/backend**:
- Le frontend bypass Turnstile pour Safari iOS et envoie un token vide
- Le commentaire indique que la protection est maintenue par le rate limiting
- **MAIS** le backend n'a jamais été modifié pour accepter ce bypass
- En production/preview, `verify()` rejette immédiatement les tokens vides (ligne 52-55)

## Solution Proposée

Modifier `turnstile.service.ts` pour accepter le token vide et se fier au rate limiting:

```typescript
async verify(token: string, ip?: string): Promise<boolean> {
  // Skip in non-production environments
  if (this.skipVerification) {
    this.logger.debug('Turnstile verification skipped (non-production)');
    return true;
  }

  // Allow empty token - protected by rate limiting (30 req/h/IP)
  // Required for Safari iOS where Turnstile cross-origin is blocked
  if (!token) {
    this.logger.info('Empty Turnstile token accepted (rate-limited endpoint)');
    return true;  // ← Changement: accepter le token vide
  }

  // ... rest of Cloudflare verification
}
```

**Sécurité maintenue par**:
- Rate limiting: 30 req/hour/IP (déjà en place)
- Le rate limiting est appliqué AVANT la vérification Turnstile
- Les bots/attaquants sont limités à 30 tentatives/heure maximum

## Dependencies

- `@nestjs/throttler` - Rate limiting (déjà configuré)
- Aucune nouvelle dépendance requise

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Bots peuvent créer 30 sessions/heure/IP | Acceptable - coût limité, sessions nettoyées après 24h |
| Attaque distribuée (multiple IPs) | Non résolu par Turnstile non plus |
| Abus du bypass | Logging activé pour monitoring |

## Next Steps

1. Modifier `turnstile.service.ts` pour accepter token vide
2. Ajouter logging pour traçabilité
3. Tester sur Safari iOS
4. Déployer sur preview et valider
