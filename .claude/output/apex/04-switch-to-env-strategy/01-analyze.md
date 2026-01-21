# Step 01: Analyze

**Task:** Switch to .env strategy. Follow existing pattern about env naming conventions in the project
**Started:** 2026-01-21T11:46:00Z

---

## Context Discovery

### Existing .env Files in Monorepo

| Package | Files | Purpose |
|---------|-------|---------|
| `frontend/` | `.env`, `.env.example`, `.env.e2e` | Angular app config |
| `backend-nest/` | `.env.example`, `.env.development`, `.env.local`, `.env.ci` | NestJS API config |
| `landing/` | **NONE** | Currently no .env files |

### Naming Conventions by Package

**Frontend (Angular)**: Uses `PUBLIC_` prefix
```
PUBLIC_ENVIRONMENT
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
PUBLIC_BACKEND_API_URL
PUBLIC_POSTHOG_API_KEY
PUBLIC_TURNSTILE_SITE_KEY
```

**Backend (NestJS)**: No prefix, uppercase snake_case
```
NODE_ENV
PORT
FRONTEND_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

**Next.js Convention**: Requires `NEXT_PUBLIC_` prefix for client-side variables

### Current Landing Implementation

**File:** `landing/lib/config.ts`
```typescript
export const ANGULAR_APP_URL =
  process.env.NODE_ENV === 'development' ? 'http://localhost:4200' : ''
```

**Usage in components:**
- `Header.tsx` → `/welcome`
- `Hero.tsx` → `/signup`
- `Platforms.tsx` → `/welcome`
- `FinalCTA.tsx` → `/signup`
- `Footer.tsx` → `/legal/*`
- `WhyFree.tsx` → `/legal/*`

### Documentation Research Findings

From Next.js documentation:
1. `process.env.NODE_ENV` is evaluated at **build time** (current approach works)
2. Best practice: Use `.env.development` and `.env.production` files
3. Client-side variables **MUST** use `NEXT_PUBLIC_` prefix
4. Variables are inlined at build time (no runtime switching)

---

## Patterns Observed

1. **Environment-specific files**: Project uses `.env.development`, `.env.local`, `.env.production` pattern
2. **Example files**: `.env.example` with documentation comments (French)
3. **No secrets in frontend**: Only public-safe values use `PUBLIC_` prefix
4. **Deployment**: Env vars injected via Vercel/Railway dashboards

---

## Inferred Acceptance Criteria

Based on task and existing patterns:

- [ ] AC1: Create `.env.development` with `NEXT_PUBLIC_ANGULAR_APP_URL=http://localhost:4200`
- [ ] AC2: Create `.env.production` with `NEXT_PUBLIC_ANGULAR_APP_URL=` (empty for same-origin)
- [ ] AC3: Create `.env.example` with documentation (following French comments pattern)
- [ ] AC4: Update `landing/lib/config.ts` to use `process.env.NEXT_PUBLIC_ANGULAR_APP_URL`
- [ ] AC5: Add `.env*.local` to `.gitignore` (if not already)
- [ ] AC6: Quality checks pass (`pnpm quality`)

---

## Step Complete

**Status:** ✓ Complete
**Files found:** 8 .env files across monorepo
**Patterns identified:** 3 (PUBLIC_ prefix, env-specific files, example with docs)
**Next:** step-02-plan.md
**Timestamp:** 2026-01-21T11:50:00Z
