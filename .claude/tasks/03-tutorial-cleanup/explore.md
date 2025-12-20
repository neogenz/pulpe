# Task: Tutorial System Cleanup

## Overview

Post-bugfix cleanup of the tutorial system to improve code quality, logging consistency, and maintainability.

---

## Issues Identified

### 1. Magic Number: `setTimeout(800ms)`

**Location:** `feature/current-month/current-month.ts:255-265`

```typescript
setTimeout(() => {
  // ... tutorial start logic
}, 800); // Delay to allow page to fully render
```

**Problem:** Magic number without named constant. The purpose is clear from the comment but the value is arbitrary.

**Scope:** Outside `core/tutorial/` - in a feature component.

---

### 2. Console Logging Instead of Logger Service

**Location:** Multiple files in `core/tutorial/`

**Count:** 14 console calls found:
- `tutorial.service.ts`: 10 calls (error, warn, info)
- `tutorial-configs.ts`: 4 calls (error only)

**Pattern in Logger (`core/logging/logger.ts`):**
- `Logger.debug()` - suppressed in production
- `Logger.info()` - suppressed in production
- `Logger.warn()` - always logged
- `Logger.error()` - always logged, sanitizes sensitive data

**Current Usage:**
```typescript
console.info('[TutorialService] Event:', event);  // Line 353
console.error('[TutorialService] Failed to start tour:', { tourId, error });  // Line 147
```

**Why Change:** Logger provides:
- Environment-aware suppression
- Automatic data sanitization
- Consistent formatting with timestamps
- PostHog integration for errors

---

### 3. PostHog Analytics Not Integrated

**Location:** `tutorial.service.ts:350-358`

```typescript
#trackEvent(event: TutorialEvent): void {
  try {
    // TODO: Integrate with PostHog or your analytics service
    console.info('[TutorialService] Event:', event);
  } catch (error) {
    console.warn('[TutorialService] Failed to track event:', error);
  }
}
```

**Current State:** Placeholder with TODO comment. Events are logged but not sent to analytics.

**Analytics Service:** `core/analytics/analytics.ts` exists with PostHog integration.

---

### 4. Help Menu Tours Hardcoded

**Location:** `layout/main-layout.ts:265-319`

**Current State:** 4 tour buttons manually defined with hardcoded IDs:
- `'dashboard-welcome'`
- `'add-transaction'`
- `'templates-intro'`
- `'budget-management'`

**Source of Truth:** `ALL_TOURS` array in `tutorial-configs.ts`

**Analysis:**
- Each tour has `name`, `description`, and `id` properties
- Help menu duplicates the names/icons
- Adding a new tour requires changes in 2 places

**Consideration:** Dynamic generation would require:
- Icon mapping (not in TutorialTour type currently)
- Filtering (not all tours should appear in help menu)
- Template complexity vs maintainability tradeoff

---

## Key Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `core/tutorial/tutorial.service.ts` | Main service | Replace console with Logger, integrate PostHog |
| `core/tutorial/tutorial-configs.ts` | Tour definitions | Replace console.error with Logger |
| `feature/current-month/current-month.ts` | Dashboard feature | Extract setTimeout delay to constant |
| `layout/main-layout.ts` | Help menu | Evaluate dynamic tour list |
| `core/logging/logger.ts` | Logging service | Reference only |
| `core/analytics/analytics.ts` | PostHog wrapper | Reference for integration |

---

## Dependencies

- `Logger` service already exists and is injectable
- `Analytics` service exists with `captureEvent()` method
- No new dependencies required

---

## Patterns to Follow

### Logger Injection Pattern (from other services)
```typescript
readonly #logger = inject(Logger);

// Usage
this.#logger.info('Message', { data });
this.#logger.error('Error message', error);
```

### Analytics Pattern (from other services)
```typescript
readonly #analytics = inject(Analytics);

// Usage
this.#analytics.captureEvent('tutorial_completed', { tourId });
```
