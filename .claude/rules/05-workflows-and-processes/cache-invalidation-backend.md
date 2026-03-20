---
description: Backend cache invalidation rule — ensures data freshness after mutations
paths: "backend-nest/src/**/*.ts"
---

# Backend Cache Invalidation

## Rule

**ALWAYS** call `cacheService.invalidateForUser(userId)` after any mutation that modifies data served by a cached endpoint.

## Why

`BudgetService.findAll()` and other list endpoints use `CacheService.getOrSet()` with a 30-second TTL. If a mutation modifies the underlying data (e.g., budget lines, transactions, balances) without invalidating the cache, subsequent GET requests serve stale data until the TTL expires.

This caused a real bug: template propagation updated budget lines in the database, but `GET /budgets` returned stale cached responses — the budget list showed old "Disponible" values.

## When to invalidate

Any service method that:

1. **Writes to `budget_line`** (create, update, delete, propagation)
2. **Writes to `monthly_budget`** (create, update balance recalculation)
3. **Writes to `transaction`** (create, update, delete, toggle check)
4. **Calls an RPC** that modifies budget-related tables (e.g., `apply_template_line_operations`)

## How

```typescript
// After the mutation succeeds:
await this.cacheService.invalidateForUser(user.id);
```

`CacheService` is `@Global()` — injectable anywhere without module imports.

## Checklist for new mutations

- [ ] Does this mutation change data returned by `GET /budgets` or `GET /budgets/:id/details`?
- [ ] If yes: is `cacheService.invalidateForUser()` called after the mutation?
- [ ] If the mutation is in a different module than `BudgetService`: is `CacheService` injected?

## Current cached endpoints

| Endpoint | Cache key pattern | TTL |
|----------|------------------|-----|
| `GET /budgets` | `budgets:list:*` | 30s |

## Anti-Patterns

```typescript
// WRONG — mutation without cache invalidation
async propagateChanges(...) {
  await supabase.rpc('apply_template_line_operations', ...);
  await this.recalculateBalances(...);
  // Missing: cacheService.invalidateForUser(user.id)
}

// CORRECT
async propagateChanges(...) {
  await supabase.rpc('apply_template_line_operations', ...);
  await this.recalculateBalances(...);
  await this.cacheService.invalidateForUser(user.id);
}
```
