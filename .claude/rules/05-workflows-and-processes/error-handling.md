---
description: "Webapp error reporting — what reaches PostHog and what is filtered as expected noise"
paths: "frontend/**/core/{analytics,api}/**/*.ts"
---

# Webapp Error Reporting

## Principle

Report **unexpected** errors, filter **expected** ones. An error the app already handles — a
refused token, a rate limit, a stale chunk, an offline request — is not a bug, and capturing it
drowns the real ones. Every filter below exists because something legitimate was producing noise.

The vendor is **PostHog** (`captureException`). There is no Sentry in this project.

## The two capture points

| Where | File | Captures |
| --- | --- | --- |
| HTTP errors | `core/analytics/http-error-interceptor.ts` | every `HttpErrorResponse` not filtered below |
| JS runtime errors | `core/analytics/global-error-handler.ts` | uncaught exceptions, null refs, type errors |

They are **mutually exclusive by design**: `GlobalErrorHandler` returns early on
`HttpErrorResponse` and on `ApiError` with `status > 0`, because the interceptor already captured
those. Adding a capture on one side without checking the other double-reports.

## What is filtered, and why

Interceptor (`http-error-interceptor.ts`):

- **401, 403** — `authInterceptor` handles them (token refresh, redirect). Not bugs.
- Everything `isExpectedBusinessHttpError()` matches, in `core/api/http-expected-business-noise.ts`:
  - **status 0** — no HTTP response at all: offline, aborted request, backgrounded mobile tab,
    CORS preflight failure. Not actionable from our side.
  - **429** — rate limit, an expected server answer.
  - **400** carrying `RECOVERY_KEY_INVALID`, `RECOVERY_KEY_NOT_CONFIGURED` or
    `ENCRYPTION_KEY_CHECK_FAILED` — a user typing a wrong recovery key is a normal flow.

`GlobalErrorHandler` (`global-error-handler.ts`):

- **`HttpErrorResponse`**, and **`ApiError` with `status > 0`** — already captured by the interceptor.
- **`isChunkLoadError(error)`** — stale-chunk errors are handled by `withNavigationErrorHandler`
  in the router config. One reaching here means the reload was already attempted.

## The asymmetry to preserve

`ApiError` with **`status === 0`** is **NOT** filtered, unlike `HttpErrorResponse` with status 0.
A zero-status `ApiError` means a Zod parse failure or a generic JS failure — a real bug worth
reporting. The comment at `http-expected-business-noise.ts:33-37` says so; do not "simplify" the
two paths into one.

## Always

- Log **or** throw, never both — the error reaches a capture point on its own.
- A new filter needs a named reason, in the same shape as the ones above.
- Widening a filter (a whole status class, a bare `catch`) hides bugs. Narrow it to a code.
