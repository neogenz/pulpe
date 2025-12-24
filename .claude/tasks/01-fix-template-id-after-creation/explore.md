# Task: Fix template ID undefined after creation

**GitHub Issue:** https://github.com/neogenz/pulpe/issues/116

## Problem Summary

After adding a template, it's added locally to the store WITHOUT its ID from the backend. When users click to view template details without reloading the page, the URL receives "undefined" as the ID parameter, breaking navigation.

## Root Cause Analysis

The bug occurs due to a **type mismatch between API response and state handling**:

1. Backend returns `BudgetTemplateCreateResponse` with structure:
   ```typescript
   { success: true, data: { template, lines } }
   ```

2. Frontend API service incorrectly declares return type as `BudgetTemplateResponse`:
   ```typescript
   { success: true, data: BudgetTemplate }
   ```

3. State service uses `response.data` thinking it's a `BudgetTemplate`, but it's actually `{ template, lines }`

4. The incorrect object gets stored in local state, causing `template().id` to be undefined

5. Navigation attempts to use undefined ID, creating URL like `/app/budget-templates/details/undefined`

## Codebase Context

### Key Files

| File | Line | Purpose |
|------|------|---------|
| `frontend/.../budget-templates/services/budget-templates-api.ts` | 37-39 | API service with wrong return type |
| `frontend/.../budget-templates/services/budget-templates-state.ts` | 80-86 | State update using wrong data path |
| `frontend/.../budget-templates/create/create-template-page.ts` | 100-121 | Navigation logic checking for ID |
| `shared/schemas.ts` | 524-533 | Correct response schema definition |

### API Response Types (from shared/schemas.ts)

```typescript
// Create response (line 524-530)
budgetTemplateCreateResponseSchema = {
  success: true,
  data: { template: BudgetTemplate, lines: BudgetLine[] }
}

// Read response (line 502-505)
budgetTemplateResponseSchema = {
  success: true,
  data: BudgetTemplate
}
```

### Current Buggy Code

**budget-templates-api.ts:37-39**
```typescript
create$(data: BudgetTemplateCreateData): Observable<BudgetTemplateResponse> {
  // ❌ Wrong return type - should be BudgetTemplateCreateResponse
  return this.http.post<BudgetTemplateResponse>(this.API_URL, data);
}
```

**budget-templates-state.ts:80-86**
```typescript
// After API call succeeds
this.#templates.update((templates) =>
  templates.map((t) =>
    t.id === optimisticTemplate.id ? response.data : t  // ❌ Should be response.data.template
  )
);
return response.data;  // ❌ Should be response.data.template
```

## Patterns to Follow

### Optimistic UI Update Pattern
```typescript
// 1. Create temp ID
const optimisticTemplate = { ...data, id: `temp-${Date.now()}` };

// 2. Add to local state immediately
this.#templates.update((templates) => [...templates, optimisticTemplate]);

// 3. Call API
const response = await firstValueFrom(this.api.create$(data));

// 4. Replace temp with real data (FIX: use response.data.template)
this.#templates.update((templates) =>
  templates.map((t) => t.id === optimisticTemplate.id ? response.data.template : t)
);

// 5. Return for navigation
return response.data.template;
```

### Signal-based State Management
- Private writable signals with public computed selectors
- Immutable updates via `signal.update()`

## Fix Required

### 1. Fix API return type
**File:** `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-api.ts`
- Line 37: Change `Observable<BudgetTemplateResponse>` to `Observable<BudgetTemplateCreateResponse>`

### 2. Fix state update to use correct data path
**File:** `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-state.ts`
- Line 82: Change `response.data` to `response.data.template`
- Line 86: Change `return response.data` to `return response.data.template`

## Dependencies

- Import `BudgetTemplateCreateResponse` type in API service (from `@pulpe/shared`)

## Testing Strategy

1. Create a new template
2. Without refreshing, click on the newly created template card
3. Verify URL shows correct UUID (not "undefined")
4. Verify template details page loads correctly
