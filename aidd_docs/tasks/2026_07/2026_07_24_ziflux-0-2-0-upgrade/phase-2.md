---
status: done
---

# Instruction: Review the behavior changes against their live call sites

## Architecture projection

> Read-only unless task 1 concludes the resume path needs gating. Nothing else is expected to change.

```txt
.
└── frontend/projects/webapp/src/app/
    └── core/lifecycle/resume-refresh.service.ts        ✏️  only if task 1 decides the extra fetch per resume is unwanted
```

## Tasks to do

### `1)` Decide what `reload()` refetching for real should do on app resume

> 0.2.0 fixed `reload()`: inside `staleTime` it used to return without a request. Fifteen call sites
> silently gain a network call. Fourteen of them are user-triggered and want it. One is not.

1. `core/lifecycle/resume-refresh.service.ts:149` calls `#userSettingsStore.reload()` on every resume,
   under a 60 s `staleTime` (`user-settings-api.ts:21`). Before 0.2.0 a resume inside that window was
   a no-op; now every resume issues a `GET /user-settings`. Establish how often `#runSoftRefresh` actually
   fires (which triggers feed it, whether a tab switch counts) before deciding.
2. Pick one and write the reason into the code, not into this file:
   - leave it — a soft refresh that refreshes nothing was the bug, and one small GET per resume is the fix;
   - or gate it, since the two lines above it already call `cache.invalidate()`, which marks the entry stale
     and lets the next read revalidate on its own.
3. Confirm the other 14 sites are wanted as-is. They are retry buttons, pull-to-refresh, and post-mutation
   refreshes — each one a place where the old no-op was a latent bug. Spot-check the two most visible:
   the retry action in `feature/settings/tags-settings-page.ts:61` and
   `feature/current-month/services/dashboard-store.ts:308`.

### `2)` Confirm the invalidation-cost change is affordable where it fires from an effect

> `invalidate()` is a flag now, and a raced in-flight fetch is never reused, so invalidations spread over
> time cost one refetch each instead of sometimes sharing one.

1. `core/savings-goal/savings-goal-api.ts:41` invalidates goal progress and contributions from an `effect`
   watching `budgetApi.cache.version()`. Confirm this stays one refetch per budget mutation, not per
   budget-cache version bump, and that a burst of mutations in one tick still collapses.
2. `savings-goal-api.spec.ts:165` already pins this behavior (`fresh` must be `false` after a budget
   invalidation). Confirm it still passes and now holds for a stronger reason: a per-resource `staleTime`
   larger than the cache's can no longer swallow the invalidation.

### `3)` Record what 0.2.0 offers that this app should not adopt yet

> The release adds four opt-in features. None is needed to upgrade. Name them so the next reader does not
> re-derive the analysis.

1. Append to the plan folder, in a sentence each: `refetchOnWindowFocus` (a better-fitting primitive than
   the manual resume reload of task 1), `refetchOnReconnect`, `id` for `TransferState` (the webapp does not
   server-render), and `defaultValue` (would retire ~25 `value() ?? []` fallbacks, a refactor, not an upgrade).
2. Do not implement any of them in this task.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | The resume path either keeps its `reload()` with a comment saying why the extra request is wanted, or drops it in favor of the invalidation above it. |
| 2    | `savings-goal-api.spec.ts` passes, and the goal-progress refetch count per budget mutation is stated as an observed number, not an estimate.  |
| 3    | The four opt-in features are named with a one-line verdict each, and none appears in the diff.                                                |
