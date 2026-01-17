# MR Review Fixes - Implementation Plan

**Date:** 2026-01-16
**Context:** Fix issues identified in PR review - TypeScript `any` violations and circular dependency
**Strategy:** Incremental, low-risk approach with testing after each step

---

## Overview

### Issues to Fix

1. ✅ **TypeScript `any` violations** (37 instances across 4 test files)
2. ✅ **Circular dependency** between AuthSessionService ↔ AuthCleanupService
3. ✅ **Code formatting** (AAA pattern consistency)

### False Positives (Verified as Non-Issues)
- ❌ Missing type imports (types ARE imported)
- ❌ SIGNED_OUT cleanup missing (it's implemented)

---

## Task Breakdown

### Task 1: Create Typed Mock Helper (Foundation)
**Risk:** Low | **Files:** 1 | **Estimated Time:** 10 min

**Objective:** Create reusable typed mock for Supabase client

**Files to Modify:**
- `frontend/projects/webapp/src/app/core/testing/test-utils.ts` (append)

**Implementation:**
```typescript
export interface MockSupabaseAuth {
  signOut: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
}

export interface MockSupabaseClient {
  auth: MockSupabaseAuth;
}

export function createMockSupabaseClient(): MockSupabaseClient {
  return {
    auth: {
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      setSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  };
}
```

**Testing:**
- Verify TypeScript compilation
- No runtime tests needed (utility function)

---

### Task 2: Replace `any` Types in All Test Files
**Risk:** Medium | **Files:** 4 | **Estimated Time:** 30 min

**Objective:** Replace all `as any` type assertions with proper types

**Files to Modify (37 instances total):**

1. **auth-cleanup.service.spec.ts** (1 instance)
   - Line 22-34: Replace mock creation with `createMockSupabaseClient()`

2. **auth-credentials.service.spec.ts** (5 instances)
   - Line 22-27: Replace mock creation
   - Lines 66-69, 82-85, 122-125, 138-141: Replace `as any` with proper types

3. **auth-oauth.service.spec.ts** (6 instances)
   - Line 28-32: Replace mock creation
   - Lines 81-87, 99-105, 119-125, 132-138, 150-156: Replace `as any`

4. **auth-session.service.spec.ts** (25 instances)
   - Line 83-90: Replace mock creation
   - All remaining instances: Replace Supabase result type casts

**Pattern:**
```typescript
// Before:
mockSupabaseClient = {
  auth: { signOut: vi.fn() } as any,
};

// After:
mockSupabaseClient = createMockSupabaseClient();

// For return values - Before:
mockResolvedValue({ data: { user: {}, session: {} }, error: null } as any);

// After:
mockResolvedValue({ data: { user: {} as User, session: {} as Session }, error: null });
```

**Testing (After EACH file):**
- `pnpm test -- <filename>.spec.ts`
- Verify all tests pass
- Verify no TypeScript errors

---

### Task 3: Refactor Circular Dependency
**Risk:** High | **Files:** 3 services + 3 test files | **Estimated Time:** 45 min

**Objective:** Move `signOut()` from AuthCleanupService → AuthSessionService

**Architecture Decision:**
- **Option 1 (KISS):** Direct method call - AuthSessionService owns signOut, calls cleanup
- ~~Option 2: Signal-based events (rejected - same coupling, more complexity)~~

**Files to Modify:**

#### 3.1. auth-session.service.ts
**Changes:**
- ✅ Add `signOut()` method (moved from AuthCleanupService)
- ✅ Remove `#getCleanupService()` lazy injection workaround
- ✅ Remove `#cleanupService` field
- ✅ Remove `#injector` import and field
- ✅ Inject `AuthCleanupService` directly via `inject()`
- ✅ Update SIGNED_OUT handler

**Code:**
```typescript
// ADD at top with other injections:
readonly #cleanup = inject(AuthCleanupService);

// REMOVE:
// readonly #injector = inject(Injector);
// #cleanupService: AuthCleanupService | null = null;
// #getCleanupService(): AuthCleanupService { ... }

// ADD new method:
async signOut(): Promise<void> {
  const userId = this.#state.user()?.id;

  try {
    if (this.#isE2EBypass()) {
      this.#logger.info('🎭 Mode test E2E: Simulation du logout');
      this.#updateAuthState(null);
      this.#cleanup.performCleanup(userId);
      return;
    }

    const { error } = await this.#supabaseClient!.auth.signOut();
    if (error) {
      this.#logger.error('Erreur lors de la déconnexion:', error);
    }
    this.#updateAuthState(null);
    this.#cleanup.performCleanup(userId);
  } catch (error) {
    this.#logger.error('Erreur inattendue lors de la déconnexion:', error);
  }
}

// UPDATE SIGNED_OUT handler:
case 'SIGNED_OUT': {
  const userId = this.#state.user()?.id;
  this.#updateAuthState(null);
  this.#cleanup.performCleanup(userId);
  break;
}
```

#### 3.2. auth-cleanup.service.ts
**Changes:**
- ✅ Remove `signOut()` method entirely
- ✅ Remove `#session` field
- ✅ Keep `performCleanup()` as public API
- ✅ Keep `#handleSignOut()` private method

**Code:**
```typescript
// REMOVE:
// readonly #session = inject(AuthSessionService);
// async signOut(): Promise<void> { ... }

// KEEP:
performCleanup(userId?: string): void {
  this.#handleSignOut(userId);
}

#handleSignOut(userId?: string): void {
  // ... existing cleanup logic unchanged
}
```

#### 3.3. auth-api.ts
**Changes:**
- ✅ Update `signOut()` to call `AuthSessionService.signOut()`

**Code:**
```typescript
// Before:
async signOut(): Promise<void> {
  return this.#cleanup.signOut();
}

// After:
async signOut(): Promise<void> {
  return this.#session.signOut();
}
```

#### 3.4. Test File Updates

**auth-session.service.spec.ts:**
- ✅ Add tests for new `signOut()` method
- ✅ Add mock for `AuthCleanupService`

**auth-cleanup.service.spec.ts:**
- ✅ Remove all `signOut()` tests
- ✅ Remove `mockSupabaseClient` dependency
- ✅ Keep `performCleanup()` tests

**auth-api.spec.ts:**
- ✅ Update mock expectations (call session.signOut instead of cleanup.signOut)

**Testing Strategy:**
1. Run `pnpm test -- auth-session.service.spec.ts`
2. Run `pnpm test -- auth-cleanup.service.spec.ts`
3. Run `pnpm test -- auth-api.spec.ts`
4. Run full auth test suite: `pnpm test -- core/auth/`
5. Manual verification: Login/logout flow

---

### Task 4: Format and Final Cleanup
**Risk:** Low | **Files:** All modified | **Estimated Time:** 10 min

**Objective:** Ensure code quality standards

**Changes:**
1. Run `cd frontend && pnpm format`
2. Add blank lines for AAA pattern consistency where missing
3. Run `pnpm quality` (lint + typecheck + format check)
4. Run full test suite

**Verification:**
- No linting errors
- No TypeScript errors
- All tests pass
- Proper formatting

---

## Execution Order

```
Task 1 (Foundation)
  ↓ Test: Verify TS compilation
Task 2 (Fix any types)
  ↓ Test: Each file individually
Task 3 (Circular dependency)
  ↓ Test: Full auth suite + manual
Task 4 (Format)
  ↓ Test: pnpm quality
```

---

## Risk Mitigation

**After Each Step:**
- Run tests for modified files
- Verify TypeScript compilation
- Check for unexpected errors

**Rollback Strategy:**
- Each task is a logical commit point
- Can revert individual tasks if needed

**High-Risk Areas:**
- Task 3 (circular dependency) - most complex
- Test carefully with both unit and integration tests

---

## Success Criteria

- ✅ Zero `as any` in test files
- ✅ No circular dependency (no `Injector.get()` workaround)
- ✅ All tests passing
- ✅ Code formatted correctly
- ✅ TypeScript strict mode passing
- ✅ Login/logout flow works in app
