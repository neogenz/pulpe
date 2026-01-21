# Step 03: Execute

**Task:** Switch to .env strategy. Follow existing pattern about env naming conventions in the project
**Started:** 2026-01-21T12:05:00Z

---

## Execution Log

### 1. Created `.env.development`
**File:** `landing/.env.development`
**Content:**
```env
# Configuration Landing - Développement local
NEXT_PUBLIC_ANGULAR_APP_URL=http://localhost:4200
```
**Status:** ✓ Created

---

### 2. Created `.env.production`
**File:** `landing/.env.production`
**Content:**
```env
# Configuration Landing - Production
NEXT_PUBLIC_ANGULAR_APP_URL=
```
**Status:** ✓ Created

---

### 3. Created `.env.example`
**File:** `landing/.env.example`
**Content:**
```env
# Variables d'environnement - Landing Pulpe
# Copiez ce fichier vers .env.local et personnalisez les valeurs

# === APP ANGULAR ===
# URL de l'app Angular - Local: http://localhost:4200 | Production: (vide, même origine)
NEXT_PUBLIC_ANGULAR_APP_URL=http://localhost:4200

# === INSTRUCTIONS ===
#
# LOCAL (développement)
#   - Les valeurs par défaut sont dans .env.development
#   - Créez .env.local pour des overrides personnalisés
#
# PRODUCTION
#   - Variables via Vercel dashboard
#   - NEXT_PUBLIC_ANGULAR_APP_URL vide (même domaine)
```
**Status:** ✓ Created

---

### 4. Updated `lib/config.ts`
**File:** `landing/lib/config.ts`
**Before:**
```typescript
export const ANGULAR_APP_URL =
  process.env.NODE_ENV === 'development' ? 'http://localhost:4200' : ''
```
**After:**
```typescript
export const ANGULAR_APP_URL = process.env.NEXT_PUBLIC_ANGULAR_APP_URL || ''
```
**Status:** ✓ Modified

---

### 5. Verified `.gitignore`
**File:** `landing/.gitignore`
**Line 14:** `.env*.local` already present
**Status:** ✓ Already configured

---

### 6. Quality Checks
**Command:** `pnpm type-check && pnpm lint`
**Result:**
- TypeScript: ✓ No errors
- ESLint: ✓ No warnings or errors

**Status:** ✓ Passed

---

## Summary

| AC | File | Status |
|----|------|--------|
| AC1: .env.development | `landing/.env.development` | ✓ Created |
| AC2: .env.production | `landing/.env.production` | ✓ Created |
| AC3: .env.example | `landing/.env.example` | ✓ Created |
| AC4: Update config.ts | `landing/lib/config.ts` | ✓ Modified |
| AC5: .gitignore | `landing/.gitignore` | ✓ Already had `.env*.local` |
| AC6: Quality checks | N/A | ✓ Passed |

---

## Files Changed

```
landing/
├── .env.development     (NEW)
├── .env.production      (NEW)
├── .env.example         (NEW)
└── lib/config.ts        (MODIFIED)
```

---

## Step Complete

**Status:** ✓ Complete
**Files created:** 3
**Files modified:** 1
**Quality checks:** Passed
**Next:** step-04-validate.md
**Timestamp:** 2026-01-21T12:08:00Z
