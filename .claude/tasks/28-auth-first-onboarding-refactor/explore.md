# Task: Auth-First Onboarding Refactor

## Executive Summary

This exploration covers the complete refactoring from a 9-step non-authenticated onboarding flow to a simplified auth-first approach. The research confirms that for personal finance apps, an auth-first approach with 3-4 screens is optimal, leveraging the existing CompleteProfile feature.

**Key Decision:** Remove the 9-step onboarding, create a new welcome page, and route authenticated users without budgets to the existing CompleteProfile feature.

---

## Codebase Context

### Current Architecture (To Be Replaced)

```
CURRENT FLOW (9 steps, ~5-7 minutes):
/onboarding/welcome → personal-info → income → housing → phone-plan
→ transport → leasing-credit → health-insurance → registration

Files involved:
├── feature/onboarding/
│   ├── onboarding.routes.ts
│   ├── onboarding-store.ts (signal-based, localStorage persistence)
│   ├── onboarding-state.ts (types)
│   ├── onboarding-step-guard.ts
│   ├── onboarding-layout.ts
│   └── steps/ (9 components)
```

### Target Architecture (Auth-First)

```
NEW FLOW (3-4 screens, ~2-3 minutes):
/welcome → /login (or Google OAuth) → /app/complete-profile → /app/current-month

Files to create/modify:
├── feature/welcome/ (NEW - standalone welcome page)
├── feature/auth/login/ (MODIFY - enhance with welcome messaging)
├── feature/complete-profile/ (REUSE - already has 2-step stepper)
├── app.routes.ts (MODIFY - update routing structure)
├── core/auth/auth-guard.ts (MODIFY - redirect to /welcome instead of /onboarding)
```

### Data Model Comparison

| Field | OnboardingStore | CompleteProfileStore | ProfileData (shared) |
|-------|-----------------|---------------------|---------------------|
| firstName | ✅ | ✅ | ✅ Required |
| monthlyIncome | ✅ | ✅ | ✅ Required |
| housingCosts | ✅ | ✅ | Optional |
| healthInsurance | ✅ | ✅ | Optional |
| phonePlan | ✅ | ✅ | Optional |
| transportCosts | ✅ | ✅ | Optional |
| leasingCredit | ✅ | ✅ | Optional |
| email | ✅ | ❌ (from OAuth) | N/A |
| isUserCreated | ✅ (internal) | ❌ | N/A |

**Key Insight:** CompleteProfileStore already has ALL fields needed for budget creation. No data model changes required.

### Existing Shared Infrastructure

```typescript
// Already shared between onboarding and complete-profile
ProfileSetupService.createInitialBudget(profileData: ProfileData): Promise<ProfileSetupResult>

// Guards already in place
hasBudgetGuard: redirects to /app/complete-profile if no budget
publicGuard: redirects authenticated users away from public routes
authGuard: protects /app/* routes
```

---

## Key Files

### To Delete (Onboarding Feature)
- `frontend/projects/webapp/src/app/feature/onboarding/` - entire directory (9 step components, store, guards, routes)

### To Modify

| File | Line | Purpose |
|------|------|---------|
| `app.routes.ts:19-23` | Remove /onboarding route |
| `app.routes.ts:7-11` | Change root redirect from /app to /welcome |
| `core/auth/auth-guard.ts:28` | Redirect to /welcome instead of /onboarding |
| `core/auth/public-guard.ts` | Add /welcome to public routes |
| `core/storage/storage-keys.ts:17-18` | Remove ONBOARDING_DATA keys (optional cleanup) |

### To Create

| File | Purpose |
|------|---------|
| `feature/welcome/welcome.routes.ts` | Route config for welcome page |
| `feature/welcome/welcome-page.ts` | New standalone welcome page component |

### To Keep (Reuse)

| File | Purpose |
|------|---------|
| `feature/complete-profile/*` | Already handles profile completion |
| `feature/auth/login/*` | Already handles email + Google OAuth |
| `core/profile/profile-setup.service.ts` | Already shared for budget creation |
| `core/auth/has-budget.guard.ts` | Already redirects to complete-profile |

---

## Documentation Insights

### UX Best Practices for Finance Apps (2025-2026)

1. **Optimal Screen Count:** 5-7 screens (balances info with completion rates)
2. **68%** of fintech users abandon during onboarding
3. **Google OAuth reduces friction** by ~40% vs. email-only
4. **One-task-per-screen** approach reduces abandonment significantly
5. **Time-to-Value:** First 4 screens should take <3 minutes

### Welcome Screen Best Practices

- **Single value proposition headline** (not feature list)
- **Google OAuth as primary CTA** (if analytics support it)
- **Trust signals**: security badges, user count
- **Minimal copy**: lead with pain point, not features

### Auth Screen Design

- **"Continue with Google"** phrasing (less intimidating than "Sign up")
- **Email as secondary option** with progressive disclosure
- **Single tap target** on mobile: minimum 48dp

---

## Research Findings

### Industry Benchmarks

| App | Approach | Key Insight |
|-----|----------|-------------|
| YNAB | Auth-first, education after | Minimal signup friction, rich onboarding post-auth |
| Copilot | Auth-first, 60-day trial | Risk removal through trial period |
| Revolut | Progressive KYC | App exploration before full verification |
| Wise | Auth-first, OCR KYC | 15-second verification with biometrics |

### Conversion Statistics

- **Reducing form fields from 9 to 6** → +25% signups
- **15-second KYC** possible with OCR + biometrics
- **One-task-per-screen** → significant abandonment reduction
- **Biometric login** → increases return engagement

---

## Patterns to Follow

### From Existing Codebase

1. **Signal-based state management** - CompleteProfileStore pattern
2. **ProfileSetupService** - already handles budget creation
3. **Guard chain** - publicGuard → authGuard → hasBudgetGuard
4. **Material stepper** - CompleteProfile already uses it

### From Research

1. **Google OAuth primary** - single prominent button
2. **Progressive disclosure** - one task per screen
3. **Skip options** - every screen except auth
4. **Trust signals** - security badges, encryption messaging

---

## Dependencies

### No Changes Required

- Backend `/budget-templates/from-onboarding` endpoint (already works)
- ProfileSetupService (already shared)
- CompleteProfileStore (already has all fields)
- hasBudgetGuard (already routes correctly)

### Guard Updates

```
Current: authGuard → redirects to /onboarding
New:     authGuard → redirects to /welcome
```

---

## Proposed User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    NEW AUTH-FIRST FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. /welcome (PUBLIC)                                       │
│     ├── Value proposition + Lottie animation                │
│     ├── CTA: "Continuer avec Google" (primary)              │
│     ├── CTA: "Utiliser mon email" (secondary)               │
│     └── Link: "Déjà un compte ? Se connecter"               │
│                          │                                  │
│                          ▼                                  │
│  2. /login (PUBLIC) ─────┬─── Google OAuth ────┐            │
│     └── Email/password   │                     │            │
│                          │                     │            │
│                          ▼                     ▼            │
│  3. Authentication success                                  │
│                          │                                  │
│                          ▼                                  │
│  4. hasBudgetGuard check                                    │
│     ├── Has budget? → /app/current-month ✅                 │
│     └── No budget? → /app/complete-profile                  │
│                          │                                  │
│                          ▼                                  │
│  5. /app/complete-profile (AUTH REQUIRED)                   │
│     ├── Step 1: Prénom + Revenu (required)                  │
│     └── Step 2: Charges fixes (optional)                    │
│                          │                                  │
│                          ▼                                  │
│  6. Budget created → /app/current-month ✅                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Checklist

### Phase 1: Create Welcome Page
- [ ] Create `feature/welcome/welcome.routes.ts`
- [ ] Create `feature/welcome/welcome-page.ts`
- [ ] Reuse Lottie animation from old welcome step
- [ ] Add Google OAuth + Email CTAs
- [ ] Add trust signals and value proposition

### Phase 2: Update Routing
- [ ] Add `/welcome` route with publicGuard
- [ ] Change root redirect to `/welcome`
- [ ] Update authGuard to redirect to `/welcome` (not `/onboarding`)
- [ ] Remove `/onboarding` route entirely

### Phase 3: Delete Old Onboarding
- [ ] Delete `feature/onboarding/` directory
- [ ] Remove ONBOARDING_DATA from storage-keys.ts
- [ ] Update any imports referencing onboarding

### Phase 4: Verify & Test
- [ ] Test new user via Google OAuth
- [ ] Test new user via email signup
- [ ] Test returning user login
- [ ] Verify hasBudgetGuard redirects correctly
- [ ] Verify budget creation works

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Demo mode breaks | Keep demo initialization in welcome page |
| SEO/deep links to old onboarding | Add 301 redirect /onboarding/* → /welcome |
| Users with localStorage data | Clear on first visit to new welcome (one-time migration) |
| Turnstile CAPTCHA for demo | Move Turnstile logic to welcome page |

---

## Next Step

Run `/epct:plan 28-auth-first-onboarding-refactor` to create the implementation plan.
