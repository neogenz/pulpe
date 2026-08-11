---
objective: "The webapp runs on ngx-ziflux 0.2.0 with every quality gate green, and each behavior change the release introduces has been checked against its live call sites."
status: implemented
---

# Plan: ngx-ziflux 0.1.0 → 0.2.0

## Overview

| Field      | Value                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| **Goal**   | Bump the webapp to ziflux 0.2.0, repair what the release breaks, and confirm the behavior changes are wanted |
| **Source** | User request: "check pour maj ziflux et ses usages si besoin dans l'app"                                     |

The upgrade itself is one line in `frontend/package.json`. The work is the fallout.

`cachedResource` stopped calling `cache.deduplicate()` / `cache.clearDirty()` and now calls
`cache._fetch()` / `cache._settle()`. Fourteen spec files hand-roll a `DataCache` object literal
that stubs the old pair and knows nothing of the new one, so their loaders will hit
`cache._fetch is not a function` at runtime. That is the whole compile-and-test break.

The five source-breaking changes MIGRATION.md lists are, checked one by one against this
codebase, non-events: no `CacheEntry` literal exists, no `error()` cast goes to a type
unassignable from `Error`, no `?? []` sits behind a `hasValue()` guard, and all 30
`cachedMutation` calls already pass `cache` and `invalidateKeys` together, so the new
dev-mode throw cannot fire.

What does land is behavioral: `reload()` now refetches inside `staleTime` where it used to
do nothing, across 15 call sites.

## Phases

| #   | Phase                            | File                         |
| --- | -------------------------------- | ---------------------------- |
| 1   | Bump and repair the test doubles | [`phase-1.md`](./phase-1.md) |
| 2   | Review the behavior changes      | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                        | Verified                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `~/workspace/perso/_projets/ziflux/MIGRATION.md`               | The five source-breaking changes and the behavior changes shipped in 0.2.0                                                       |
| `git show v0.1.0/v0.2.0:projects/ziflux/src/lib/cached-resource.ts` | `deduplicate` + `set` + `clearDirty` replaced by `_fetch` + `_settle` — the real break, absent from MIGRATION.md            |
| `git show v0.2.0:projects/ziflux/src/lib/data-cache.ts`        | `_fetch` returns `{ data, record }`; `_settle(key, result, write)` reads `record.superseded` / `record.raced`                    |
| `ziflux dist/ziflux/types/ngx-ziflux.d.ts`                     | `_fetch` / `_settle` are `@internal` and stripped from the published types, so a mock of them cannot be type-checked downstream  |
| `git show v0.1.0/v0.2.0:projects/ziflux/src/lib/cached-mutation.ts` | `cachedMutation` still only calls `cache.invalidate()` — mutation-side mocks are unaffected                                 |

## Decisions

| Decision                                                                                             | Why                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One shared `createMockDataCache()` in `core/testing/`, replacing the 14 hand-rolled literals          | The same object was copied 14 times and every copy broke on the same internal rename. Centralizing makes the next ziflux internal change a one-file edit instead of a fourteen-file sweep.         |
| Keep mocking `DataCache` rather than switching the specs to a real instance                           | Out of scope for an upgrade. Real instances would be the sturdier fix but would rewrite 14 suites' assertions; that is its own task, noted and not done here.                                       |
