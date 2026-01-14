# HasBudgetState Fusion Analysis

**Subject**: Should `HasBudgetState` be merged into an existing state service?

**Solution**: **Keep `HasBudgetState` as-is** - No existing state is a suitable candidate for fusion.

## Options Evaluated

### Option 1: Keep `HasBudgetState` Separate (RECOMMENDED)

- **Implementation**: Current 38-line dedicated service
- **Pros**:
  - Single Responsibility: guard cache only
  - Minimal footprint (15 lines of actual code)
  - Injected only where needed (3 places)
  - Easy to test in isolation
- **Cons**:
  - One more file in `core/auth/`
- **Code Impact**: None (status quo)

### Option 2: Merge into `AuthApi`

- **Implementation**: Add `#hasBudget` signal to AuthApi
- **Pros**:
  - AuthApi already handles logout cleanup
  - One less file
- **Cons**:
  - **Violates SRP**: AuthApi manages identity, not business state
  - AuthApi is already 450 lines
  - Mixing auth concerns with budget domain
- **Code Impact**: `auth-api.ts` +20 lines, delete `has-budget-state.ts`

### Option 3: Merge into `BudgetApi`

- **Implementation**: Add cached `hasBudget` signal to BudgetApi
- **Pros**:
  - Same domain (budgets)
- **Cons**:
  - **BudgetApi is an API client**, not a state manager
  - Would need to inject BudgetApi in AuthApi for logout cleanup (circular risk)
  - BudgetApi uses Observables, not signals for state
- **Code Impact**: High refactoring risk

### Option 4: Create `UserState` Service

- **Implementation**: New `core/user/user-state.ts` grouping user-related flags
- **Pros**:
  - Could group: hasBudget, hasCompletedOnboarding, etc.
  - Clean separation of user state
- **Cons**:
  - **YAGNI**: Only one flag exists today
  - Over-engineering for a single boolean
  - Would need to refactor 3 injection sites
- **Code Impact**: New file + refactor existing consumers

### Option 5: Merge into `CompleteProfileStore`

- **Implementation**: Move hasBudget cache into CompleteProfileStore
- **Pros**: None significant
- **Cons**:
  - **Wrong scope**: CompleteProfileStore is feature-level (`@Injectable()` not root)
  - CompleteProfileStore is for form state, not navigation cache
  - Would require architectural change (root vs feature)
  - CompleteProfileStore already **consumes** HasBudgetState
- **Code Impact**: Architectural violation

## Technical Analysis

### Current Injection Graph

```
HasBudgetState (root)
├── hasBudgetGuard.ts     → reads cache before API call
├── auth-api.ts           → clears cache on logout
└── complete-profile-store.ts → sets cache after first budget creation
```

### Candidate Services Compared

| Service | Scope | Domain | State Type | Suitable? |
|---------|-------|--------|------------|-----------|
| `AuthApi` | root | Identity | Signal | No - wrong domain |
| `BudgetApi` | root | Budget | Observable | No - not state manager |
| `CompleteProfileStore` | feature | Onboarding | Signal | No - wrong scope |
| `BudgetListStore` | feature | Budget List | resource() | No - wrong scope |
| `CurrentMonthStore` | feature | Dashboard | resource() | No - wrong scope |

### Key Insight

All existing **budget stores** are **feature-scoped** (provided in feature components), while `HasBudgetState` must be **root-scoped** for:
1. Guard access before any feature loads
2. Logout cleanup from AuthApi

**No feature store can replace a root service.**

## Code References

- `has-budget-state.ts:8-38` - Current implementation (38 lines)
- `has-budget.guard.ts:17-23` - Cache read before API call
- `auth-api.ts:219` - Cache clear on logout
- `complete-profile-store.ts:210` - Cache set after budget creation

## Recommendation Rationale

1. **No existing root-level state service is appropriate**
   - AuthApi = identity, not business state
   - BudgetApi = HTTP client, not state manager

2. **Feature stores have wrong scope**
   - All budget stores are lazy-loaded
   - Guard runs before features load

3. **YAGNI principle**
   - Creating `UserState` for one boolean is over-engineering
   - Current solution is minimal and focused

4. **Cost-benefit analysis**
   - Keeping: 0 effort, 38 lines
   - Any refactor: 2-4 hours, potential bugs, no real benefit

**Verdict**: The current implementation is the **correct architectural choice**. A 38-line focused service is not "overkill" - it's **right-sized** for its responsibility.
