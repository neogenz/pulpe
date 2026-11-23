---
name: rxresource-reload-and-retry-gotchas
description: rxResource keeps the old error while reloading, fixture.whenStable hangs on a pending resource, and ApiClient retries failed GETs twice (e2e error mocks)
metadata:
  type: reference
---

Three traps met while building the step 2 context read of « Comparer avec mes comptes » (2026-11-21):

- **`resource.error()` stays set while reloading after an error.** Angular 22 keeps the previous stream during `reload()`, so `@else if (res.error())` keeps the old error screen on show until the new answer lands. Gate with `res.error() && !res.isLoading()`. Anything that acts on "the screen now showing" (focus a heading) must wait for `!res.isLoading()`, or it acts on the outgoing screen.
- **`fixture.whenStable()` never settles while an `rxResource` request is out** (it registers a `PendingTask`). With a `Subject`-backed mock, click and call `fixture.detectChanges()` instead of a helper that awaits stability, then emit.
- **`ApiClient` retries transient GET failures twice** (status 0, 5xx, 408, 429). An e2e mock that fails only the first read shows no error. Fail 3 reads (`route.abort('internetdisconnected')`) or every read.

Related: [[signal-input-testing]]
