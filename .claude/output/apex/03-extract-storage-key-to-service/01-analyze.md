# Step 01: Analyze

**Task:** Extract VIEW_MODE_STORAGE_KEY into StorageService, use from budget-items-container.ts, store key in storage-key.ts
**Started:** 2026-01-20T07:01:00Z

---

## Context Discovery

### Related Files Found

| File | Lines | Contains |
|------|-------|----------|
| `core/storage/storage.service.ts` | 1-264 | `StorageService` class, `StorageKey` type |
| `core/storage/storage-keys.ts` | 1-17 | `STORAGE_KEYS` centralized constants |
| `core/storage/index.ts` | 1-2 | Barrel exports |
| `feature/budget/budget-details/budget-items-container.ts` | 34, 201, 207 | `VIEW_MODE_STORAGE_KEY` and direct localStorage usage |
| `core/demo/demo-mode.service.ts` | 1-76 | Reference implementation using StorageService |

### Current Implementation (budget-items-container.ts)

```typescript
// Line 34 - Local constant
const VIEW_MODE_STORAGE_KEY = 'pulpe-budget-desktop-view';

// Line 197-203 - Effect using direct localStorage
effect(() => {
  const mode = this.viewMode();
  const mobile = this.isMobile();
  if (!mobile) {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }
});

// Line 206-212 - Method using direct localStorage
#getInitialViewMode(): BudgetViewMode {
  const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (stored === 'table') {
    return 'table';
  }
  return 'envelopes';
}
```

### Existing Pattern (storage-keys.ts)

```typescript
import type { StorageKey } from './storage.service';

export const STORAGE_KEYS = {
  DEMO_MODE: 'pulpe-demo-mode',
  DEMO_USER_EMAIL: 'pulpe-demo-user-email',
} as const satisfies Record<string, StorageKey>;
```

### Reference Implementation (demo-mode.service.ts)

```typescript
import { StorageService, STORAGE_KEYS } from '@core/storage';

readonly #storageService = inject(StorageService);

// Usage
this.#storageService.getString(STORAGE_KEYS.DEMO_MODE)
this.#storageService.setString(STORAGE_KEYS.DEMO_MODE, 'true')
this.#storageService.remove(STORAGE_KEYS.DEMO_MODE)
```

### Patterns Observed

- **Storage keys**: Centralized in `storage-keys.ts` with `STORAGE_KEYS` constant
- **Type safety**: Uses `StorageKey` template literal type (`pulpe-${string}`)
- **Service pattern**: `StorageService` wraps localStorage with error handling and TTL support
- **Naming**: SCREAMING_SNAKE_CASE for key constants
- **Import**: From `@core/storage` barrel export

---

## Inferred Acceptance Criteria

Based on task description and existing patterns:

- [ ] AC1: Add `BUDGET_DESKTOP_VIEW` key to `STORAGE_KEYS` in `storage-keys.ts`
- [ ] AC2: Inject `StorageService` in `BudgetItemsContainer`
- [ ] AC3: Replace direct `localStorage` calls with `StorageService` methods
- [ ] AC4: Remove local `VIEW_MODE_STORAGE_KEY` constant

---

## Step Complete

**Status:** ✓ Complete
**Files found:** 5
**Patterns identified:** 4
**Next:** step-02-plan.md
**Timestamp:** 2026-01-20T07:02:00Z
