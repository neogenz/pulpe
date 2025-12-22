# Exploration: Code Review Fixes

## Context

Code review of `diff main` identified 4 actionable issues:

### Critical Issues (Security)

1. **`onboarding-store.ts:87`** - Raw `console.log` usage for debug output
2. **`breadcrumb-state.ts:89`** - Raw `console.warn` instead of Logger service

### Improvements (Angular Patterns)

3. **`welcome.ts:214`** - `@HostListener` decorator should use `host` property
4. **`registration.ts:198`** - `@HostListener` decorator should use `host` property

## Findings

### Logger Service Pattern
- Project uses `Logger` service from `@core/logging/logger`
- Logger auto-sanitizes tokens, passwords, and financial data
- Pattern: `inject(Logger)` then `this.#logger.debug/warn/error(...)`

### Host Binding Pattern
- Angular best practices: Use `host` property in `@Component` decorator
- Do NOT use `@HostListener` or `@HostBinding` decorators
- Pattern: `host: { '(keydown.enter)': 'methodName()' }`

## Files to Modify

1. `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts`
2. `frontend/projects/webapp/src/app/core/routing/breadcrumb-state.ts`
3. `frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts`
4. `frontend/projects/webapp/src/app/feature/onboarding/steps/registration.ts`
