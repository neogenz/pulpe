# Task: Extract Turnstile Logic to Dedicated Service

## Problem

The `welcome-page.ts` component is 390 lines long (limit is 300 lines). The Cloudflare Turnstile verification logic (~120 lines) should be extracted to a dedicated service for:
- Better separation of concerns
- Reusability if Turnstile is needed elsewhere
- Reduced component complexity
- Easier testing

## Proposed Solution

Create a new `TurnstileService` in `core/turnstile/` following the established pattern from `demo-initializer.service.ts`:
1. Create service with signal-based state management
2. Move all Turnstile-related constants, state, and methods to service
3. Update `welcome-page.ts` to use the new service
4. Create tests for the new service
5. Result: Component should be ~270 lines (under 300 limit)

## Dependencies

- None (independent task, can run in parallel with Tasks 1, 2, and 3)

## Context

Elements to extract from `welcome-page.ts`:
- Constant: `#TURNSTILE_TIMEOUT_MS` (line 208)
- State: `#turnstileTimeoutId`, `#turnstileResolutionHandled` (lines 209-210)
- Signal: `shouldRenderTurnstile` (line 230)
- Computed: `turnstileSiteKey`, `shouldUseTurnstile` (lines 223-228)
- Methods: `onTurnstileResolved()`, `onTurnstileError()` (lines 268-296)
- Methods: `#isSafariIOS()`, `#handleTurnstileTimeout()`, `#clearTurnstileTimeout()` (lines 355-388)

Keep in component: `isTurnstileProcessing` signal (used in `isDemoLoading` computed)

Key files:
- `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`
- Pattern: `frontend/projects/webapp/src/app/core/demo/demo-initializer.service.ts`
- Pattern: `frontend/projects/webapp/src/app/core/demo/index.ts` (barrel export)

Service structure pattern:
- `providedIn: 'root'` singleton
- Private writable signals with public readonly accessors
- Computed signals for derived values
- Clear separation of public API vs private helpers

## Success Criteria

- New folder `core/turnstile/` created with:
  - `turnstile.service.ts`
  - `turnstile.service.spec.ts`
  - `index.ts` (barrel export)
- `welcome-page.ts` reduced to < 300 lines
- Demo mode still works correctly on welcome page
- Service tests cover:
  - Signal state changes
  - Safari iOS detection
  - Token handling (valid/null)
  - Error handling
  - Timeout behavior
- E2E tests still pass
