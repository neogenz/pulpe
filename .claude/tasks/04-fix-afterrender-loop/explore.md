# Exploration: Fix afterRenderEffect Continuous Triggering

## Problem

`afterRenderEffect` in tutorial auto-start logic continues triggering checks even after:
- The tour has been launched
- The tour has been seen (completed or skipped)

This causes unnecessary re-evaluations on every render cycle.

## Root Cause

Each `afterRenderEffect` reads signals (`store.status()`, `tutorialService.hasSeenTour()`) which creates reactive dependencies. The effect re-runs whenever these signals change, even though the check only needs to happen ONCE after data loads.

## Affected Files

| File | Tour ID | Line |
|------|---------|------|
| `feature/current-month/current-month.ts` | `dashboard-welcome` | 231-247 |
| `feature/budget/budget-details/budget-details-page.ts` | `budget-management` | 204-213 |
| `feature/budget-templates/list/template-list-page.ts` | `templates-intro` | 139-148 |
| `feature/budget/budget-list/budget-list-page.ts` | `budget-calendar` | 121-133 |

## Current Pattern (Problematic)

```typescript
constructor() {
  afterRenderEffect(() => {
    const hasLoadedData = this.store.status() !== "loading";
    if (hasLoadedData && !this.#tutorialService.hasSeenTour("tour-id")) {
      this.#tutorialService.startTour("tour-id");
    }
    // Effect continues running on every render!
  });
}
```

## Solution

`afterRenderEffect()` returns an `AfterRenderRef` with a `destroy()` method. Call it once data has loaded to stop the effect permanently.

```typescript
constructor() {
  const ref = afterRenderEffect(() => {
    const hasLoadedData = this.store.status() !== "loading";
    if (hasLoadedData) {
      ref.destroy(); // Stop effect - we only need to check once
      if (!this.#tutorialService.hasSeenTour("tour-id")) {
        this.#tutorialService.startTour("tour-id");
      }
    }
  });
}
```

## Key Insight

The check should happen exactly ONCE after data loads. Whether the tour starts or not is irrelevant - the effect's job is done once `hasLoadedData` is true.

## Angular Documentation

- `afterRenderEffect()` returns `AfterRenderRef`
- `AfterRenderRef.destroy()` stops the effect permanently
- Alternative: `afterNextRender()` for true one-shot behavior (but doesn't wait for data)
