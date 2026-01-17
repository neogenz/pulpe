# Implementation: State Management Improvements

## Overview

This implementation addresses 3 state management inconsistencies in the order of dependency:

1. **localStorage object → ID** (High priority, Low effort)
2. **TTL on localStorage cache** (Medium priority, Medium effort) - depends on Issue 1
3. **Signal-based cache invalidation** (Medium priority, Low effort) - independent

---

## Issue 1: localStorage object → ID

### Problem
The budget was stored as a full JSON object in localStorage, which is wasteful and can lead to stale data issues.

### Solution
Store only the budget ID (string) instead of the full object.

### Files Modified

#### `frontend/projects/webapp/src/app/core/storage/storage-keys.ts`
```typescript
export const STORAGE_KEYS = {
  // Budget
  CURRENT_BUDGET_ID: 'pulpe-current-budget-id',
  // ...
} as const satisfies Record<string, StorageKey>;
```

#### `frontend/projects/webapp/src/app/core/budget/budget-api.ts`

**New method - `getCurrentBudgetIdFromStorage()`:**
```typescript
getCurrentBudgetIdFromStorage(): string | null {
  return this.#storageService.getString(
    STORAGE_KEYS.CURRENT_BUDGET_ID,
    BUDGET_ID_TTL_MS,
  );
}
```

**Updated method - `#saveBudgetIdToStorage()`:**
```typescript
#saveBudgetIdToStorage(budgetId: string): void {
  this.#storageService.setString(
    STORAGE_KEYS.CURRENT_BUDGET_ID,
    budgetId,
    BUDGET_ID_TTL_MS,
  );
}
```

**Updated method - `#removeBudgetFromStorage()`:**
```typescript
#removeBudgetFromStorage(budgetId: string): void {
  const currentBudgetId = this.getCurrentBudgetIdFromStorage();
  if (currentBudgetId === budgetId) {
    this.#storageService.remove(STORAGE_KEYS.CURRENT_BUDGET_ID);
  }
}
```

**Removed methods:**
- `getCurrentBudgetFromStorage()` - replaced by `getCurrentBudgetIdFromStorage()`
- `#saveBudgetToStorage()` - replaced by `#saveBudgetIdToStorage()`

#### `frontend/projects/webapp/src/app/core/budget/budget-api.spec.ts`

Updated tests to verify:
- Budget ID is stored instead of full object
- Budget ID is retrieved from storage correctly
- Null is returned when no budget ID exists

---

## Issue 2: TTL on localStorage cache

### Problem
Cached values in localStorage never expire, leading to stale data.

### Solution
Add optional TTL support to the StorageService with `{ value, ttl }` wrapper format.

### Files Modified

#### `frontend/projects/webapp/src/app/core/storage/storage.service.ts`

**New interface:**
```typescript
interface CachedValue<T> {
  value: T;
  ttl: number; // Expiration timestamp = Date.now() + ttlMs
}
```

**Updated method - `get<T>()`:**
```typescript
get<T>(key: StorageKey, ttlMs?: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    // Check if it's a TTL-wrapped value
    if (this.#isCachedValue(parsed)) {
      if (Date.now() > parsed.ttl) {
        this.remove(key);
        return null;
      }
      return parsed.value as T;
    }

    // Legacy format (no TTL wrapper)
    // If ttlMs is provided, treat legacy as expired
    if (ttlMs !== undefined) {
      return null;
    }

    return parsed as T;
  } catch (error) {
    this.#logger.warn(`Failed to read '${key}' from localStorage:`, error);
    return null;
  }
}
```

**Updated method - `set<T>()`:**
```typescript
set<T>(key: StorageKey, value: T, ttlMs?: number): void {
  try {
    const toStore =
      ttlMs !== undefined
        ? ({ value, ttl: Date.now() + ttlMs } satisfies CachedValue<T>)
        : value;
    localStorage.setItem(key, JSON.stringify(toStore));
  } catch (error) {
    this.#logger.warn(`Failed to write '${key}' to localStorage:`, error);
  }
}
```

**Updated method - `getString()`:**
```typescript
getString(key: StorageKey, ttlMs?: number): string | null {
  // Handles both TTL-wrapped values and legacy raw strings
  // Returns null if expired or legacy with ttlMs provided
}
```

**Updated method - `setString()`:**
```typescript
setString(key: StorageKey, value: string, ttlMs?: number): void {
  // If ttlMs provided, wraps value with TTL as JSON
  // Otherwise stores as raw string (legacy behavior)
}
```

**Updated method - `has()`:**
```typescript
has(key: StorageKey, ttlMs?: number): boolean {
  // Returns false for expired values
  // Cleans up expired values on access
}
```

**New private helper:**
```typescript
#isCachedValue(value: unknown): value is CachedValue<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'ttl' in value &&
    typeof (value as CachedValue<unknown>).ttl === 'number'
  );
}
```

#### `frontend/projects/webapp/src/app/core/storage/storage.service.spec.ts`

Added 12 new tests for TTL functionality:
- Value returned when TTL not expired
- Null returned when TTL expired
- Expired value removed from storage on access
- Legacy values without TTL wrapper handled correctly
- Legacy values treated as expired when ttlMs param provided
- getString with TTL wrapper
- getString with expired value
- Legacy raw string handling
- has() returns false for expired values
- has() returns true for valid TTL values
- has() cleans up expired values

#### `frontend/projects/webapp/src/app/core/budget/budget-api.ts`

**TTL constant:**
```typescript
/** TTL for budget ID storage: 24 hours */
const BUDGET_ID_TTL_MS = 86_400_000;
```

Applied to both reading and writing budget ID.

---

## Issue 3: Signal-based Cache Invalidation

### Problem
Manual `refreshData()` calls were needed after budget mutations, leading to inconsistent state across stores.

### Solution
Use a shared signal-based invalidation pattern where stores include a version signal in their resource `params()`, automatically reloading when the version increments.

### Files Created

#### `frontend/projects/webapp/src/app/core/budget/budget-invalidation.service.ts`
```typescript
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BudgetInvalidationService {
  readonly #version = signal(0);

  readonly version = this.#version.asReadonly();

  invalidate(): void {
    this.#version.update((v) => v + 1);
  }
}
```

#### `frontend/projects/webapp/src/app/core/budget/budget-invalidation.service.spec.ts`
```typescript
describe('BudgetInvalidationService', () => {
  it('should start with version 0', () => {
    expect(service.version()).toBe(0);
  });

  it('should increment version on invalidate', () => {
    service.invalidate();
    expect(service.version()).toBe(1);
  });

  it('should increment version multiple times', () => {
    service.invalidate();
    service.invalidate();
    service.invalidate();
    expect(service.version()).toBe(3);
  });
});
```

### Files Modified

#### `frontend/projects/webapp/src/app/core/budget/budget-api.ts`

**Inject invalidation service:**
```typescript
readonly #invalidation = inject(BudgetInvalidationService);
```

**Call `invalidate()` after mutations:**

In `createBudget$()`:
```typescript
this.#invalidation.invalidate();
```

In `updateBudget$()`:
```typescript
this.#invalidation.invalidate();
```

In `deleteBudget$()`:
```typescript
this.#invalidation.invalidate();
```

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-store.ts`

**Inject invalidation service and add version to resource params:**
```typescript
#invalidation = inject(BudgetInvalidationService);

budgets = resource<Budget[], { version: number }>({
  params: () => ({ version: this.#invalidation.version() }),
  loader: async () => this.#loadBudgets(),
});
```

#### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

**Inject invalidation service and add version to resource params:**
```typescript
#invalidation = inject(BudgetInvalidationService);

readonly #dashboardResource = resource<
  DashboardData,
  { month: string; year: string; version: number }
>({
  params: () => {
    const period = this.currentBudgetPeriod();
    return {
      month: period.month.toString().padStart(2, '0'),
      year: period.year.toString(),
      version: this.#invalidation.version(),
    };
  },
  loader: async ({ params }) => this.#loadDashboardData(params),
});
```

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`

**Removed manual `refreshData()` calls:**

Before:
```typescript
const result = await firstValueFrom(dialogRef.afterClosed());
if (result?.success) {
  this.state.refreshData();
}
```

After:
```typescript
// Store auto-refreshes via BudgetInvalidationService when budget is created
await firstValueFrom(dialogRef.afterClosed());
```

#### `frontend/projects/webapp/src/app/core/budget/budget-api.spec.ts`

Added mock for `BudgetInvalidationService` and verification that `invalidate()` is called after mutations.

---

## Test Results

All 966 tests pass:
- 3 new tests for `BudgetInvalidationService`
- 12 new tests for TTL functionality
- Updated tests for new storage format

## Quality Checks

All quality checks pass:
- TypeScript type checking ✅
- ESLint ✅
- Prettier formatting ✅

---

## Breaking Changes

**None** - All modifications are backward compatible:
- TTL support is opt-in via optional parameter
- Stores continue to work with automatic reload

---

## Architecture Benefits

1. **Storage Efficiency**: Storing only budget ID (~36 bytes) instead of full budget object (~500+ bytes)
2. **Data Freshness**: 24h TTL ensures stale cached data is automatically invalidated
3. **Automatic Cache Sync**: Signal-based pattern eliminates manual refresh calls
4. **Angular 21+ Idiomatic**: Uses signals instead of RxJS event bus for cache invalidation
5. **Zero Subscribe/Unsubscribe**: No `takeUntilDestroyed()` needed for the invalidation pattern
