# Findings

## Behavior changes, checked against their call sites

**`reload()` now refetches inside `staleTime`.** 15 call sites. Fourteen are retry
buttons, pull-to-refresh and post-mutation refreshes, where the old no-op was a latent
bug: `dashboard-store.refreshData()` did nothing when pressed within 30 s of load, and the
tags retry button in `settings/tags-settings-page.ts` did nothing within 60 s. The
fifteenth, `resume-refresh.service.ts`, is the only one that gains an unrequested network
call; it is kept, with the reason written in the file. `#runSoftRefresh` fires only on
`pageshow.persisted` or a discarded-tab restore, never on tab focus, and it already awaits
`refreshSession()` before that line.

**Invalidation cost, measured.** A throwaway spec on real `DataCache` instances reproduced
the `SavingsGoalApi` effect and counted goal-progress loader calls: one budget mutation
costs **1** refetch, three in the same tick cost **1**, three spread across ticks cost
**3**. `version` is bumped only by `invalidate()` and `clear()` — `set()` bumps
`_dataVersion` alone — so the effect fires once per budget mutation, not per cache write.
`savings-goal-api.spec.ts` still passes and now holds for a stronger reason: a per-resource
`staleTime` larger than the cache's can no longer swallow the invalidation.

## The four new opt-in features, and why none is adopted here

**`refetchOnWindowFocus`** would be a better-fitting primitive than the manual reload in
`resume-refresh.service.ts`, but it listens on `visibilitychange`, which is exactly the
event iOS Safari does not fire on app-switch restore — the reason that service exists.
Adopting it would narrow coverage, not widen it.

**`refetchOnReconnect`** is plausible for the dashboard, but the app has no offline story to
hang it on today; adding it now would be a behavior change nobody asked for.

**`id`** forwards to `resource()` for `TransferState` reuse. The webapp is a client-side
SPA with no server rendering, so it buys nothing.

**`defaultValue`** would retire the ~25 `value() ?? []` fallbacks across the stores. That is
a refactor with its own review surface, not part of an upgrade.
