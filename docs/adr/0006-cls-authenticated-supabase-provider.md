# 0006 — CLS-based authenticated Supabase provider

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

Each request needs an authenticated Supabase client (anon key + per-request JWT) so RLS enforces user isolation. Originally controllers received the client through a `@SupabaseClient()` decorator and threaded it through every method call: `useCase.execute(dto, user, supabase)`, `repo.findById(id, supabase)`. As the codebase grew this signature appeared on hundreds of methods. Adding or removing it became a sweeping refactor every time.

We needed the per-request client available wherever needed without polluting signatures, while keeping it scoped to the request (not a global singleton).

## Decision

Use `nestjs-cls` (continuation-local storage) to bind per-request state. `AuthGuard` (`backend-nest/src/common/guards/auth.guard.ts`) verifies the JWT once and stashes `{ user, supabase }` in CLS. `AuthenticatedSupabaseProvider` (`backend-nest/src/modules/supabase/authenticated-supabase.provider.ts`) reads `supabase` lazily from CLS via a `client` getter. Repositories inject `AuthenticatedSupabaseProvider` and call `this.supabaseProvider.client`.

Use cases never inject the client directly. Controllers may still use `@SupabaseClient()` for legacy modules (demo, encryption-controller, account-deletion) that operate outside the use-case + repo path.

The `SupabaseModule` imports `ClsModule` so `AuthenticatedSupabaseProvider` resolves CLS in DI.

## Consequences

- Positive: signatures are clean — `repo.findById(id)` instead of `repo.findById(id, supabase)`.
- Positive: adding a new repo method does not propagate `supabase` parameter changes.
- Positive: tests inject a fake `AuthenticatedSupabaseProvider` once.
- Negative: the client is implicit — calling code must know CLS is set. Not visible in signatures. Mitigated because every code path goes through `AuthGuard` first.
- Negative: tests that bypass the guard must seed CLS manually (`cls.run()` block). Cost is small; documented in test helpers.
- Negative: CLS is async-context-aware but has measurable cost (microseconds per access). Acceptable at our request rates.

## Alternatives considered

- Continue threading `supabase` through every method: rejected. Signature pollution killed readability.
- Module-scoped Supabase client (request-scoped DI provider): rejected. NestJS request-scoped providers cascade — every consumer becomes request-scoped, breaking long-lived caches.
- Static singleton + `accessToken` parameter: rejected. Forgetting to forward the token bypasses RLS silently.

## References

- `backend-nest/src/common/guards/auth.guard.ts`
- `backend-nest/src/modules/supabase/authenticated-supabase.provider.ts`
- `backend-nest/src/modules/supabase/supabase.module.ts` — `ClsModule` import
- ADR-0001
