# Task: Replace Console Logging with Logger Service

## Problem

TutorialService uses raw `console.*` calls (10 occurrences) instead of the project's Logger service. This creates inconsistency with the rest of the codebase and loses benefits like environment-aware suppression, automatic data sanitization, and consistent timestamp formatting.

## Proposed Solution

Inject the Logger service and replace all console calls with appropriate Logger methods:
- `console.error` → `this.#logger.error()`
- `console.warn` → `this.#logger.warn()`
- `console.info` → `this.#logger.info()` or `debug()` for verbose logs

## Dependencies

- None (can start immediately)

## Context

- Logger service: `core/logging/logger.ts`
- Target file: `core/tutorial/tutorial.service.ts`
- Injection pattern: `readonly #logger = inject(Logger);`
- Logger methods: `debug()`, `info()`, `warn()`, `error()`
- Production behavior: debug/info suppressed, warn/error always logged

**Console calls to replace:**
- 5x `console.error` (lines 82, 147, 171, 314, 340)
- 1x `console.warn` (line 105)
- 3x `console.info` (lines 111, 117, 353)

**Note:** The `console.info` at line 353 (tracking event log) should become `debug()` as it's verbose runtime info.

## Success Criteria

- Logger injected in TutorialService
- All 9 console calls replaced with Logger equivalents
- No more `console.*` in tutorial.service.ts
- App runs without errors
- Logs appear correctly in browser console with Logger formatting
