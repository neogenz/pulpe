# Step 02: Plan

**Task:** Switch to .env strategy. Follow existing pattern about env naming conventions in the project
**Started:** 2026-01-21T11:52:00Z

---

## Implementation Plan: Switch to .env Strategy

### Overview

Replace inline `NODE_ENV` conditional logic with environment-specific `.env` files following Next.js best practices and project conventions (French documentation comments).

### Prerequisites

- [x] Analysis complete - patterns identified
- [x] Current config.ts location known: `landing/lib/config.ts`

---

## File Changes

### 1. `landing/.env.development` (NEW FILE)

**Purpose:** Local development configuration
**Content:**
```env
# Configuration Landing - Développement local
NEXT_PUBLIC_ANGULAR_APP_URL=http://localhost:4200
```

**AC Mapping:** AC1

---

### 2. `landing/.env.production` (NEW FILE)

**Purpose:** Production configuration (same-origin)
**Content:**
```env
# Configuration Landing - Production
NEXT_PUBLIC_ANGULAR_APP_URL=
```

**AC Mapping:** AC2

---

### 3. `landing/.env.example` (NEW FILE)

**Purpose:** Documentation for developers (following project French pattern)
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

**AC Mapping:** AC3

---

### 4. `landing/lib/config.ts` (MODIFY)

**Current (line 1-2):**
```typescript
export const ANGULAR_APP_URL =
  process.env.NODE_ENV === 'development' ? 'http://localhost:4200' : ''
```

**New:**
```typescript
export const ANGULAR_APP_URL = process.env.NEXT_PUBLIC_ANGULAR_APP_URL || ''
```

**AC Mapping:** AC4

---

### 5. `landing/.gitignore` (CHECK/MODIFY)

**Action:** Verify `.env*.local` is ignored
**Expected:** Already present in Next.js default .gitignore
**If missing:** Add line `.env*.local`

**AC Mapping:** AC5

---

## Testing Strategy

**Manual verification:**
1. Run `pnpm dev` - verify landing works at localhost:3001
2. Click "Essayer" button - should navigate to localhost:4200
3. Click legal links - should navigate to localhost:4200/legal/*

**Quality checks:**
- `pnpm type-check` - TypeScript validation
- `pnpm lint` - ESLint validation

---

## Acceptance Criteria Mapping

| AC | File(s) | Status |
|----|---------|--------|
| AC1: .env.development | `landing/.env.development` | Planned |
| AC2: .env.production | `landing/.env.production` | Planned |
| AC3: .env.example | `landing/.env.example` | Planned |
| AC4: Update config.ts | `landing/lib/config.ts` | Planned |
| AC5: .gitignore | `landing/.gitignore` | Planned |
| AC6: Quality checks | N/A | Post-execution |

---

## Risks & Considerations

1. **Build-time inlining**: Variables are inlined at build time - this is expected Next.js behavior
2. **No runtime switching**: Changing env values requires rebuild (acceptable)
3. **Vercel deployment**: Env vars set in Vercel dashboard will override .env.production

---

## Step Complete

**Status:** ✓ Complete
**Files planned:** 4 files (3 new, 1 modify)
**Tests planned:** Manual verification + quality checks
**Next:** step-03-execute.md
**Timestamp:** 2026-01-21T11:54:00Z
