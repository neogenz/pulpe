# Task: Integrate PostHog Analytics for Tutorial Events

## Problem

The `#trackEvent()` method in TutorialService has a TODO placeholder and only logs events to console. Tutorial analytics (started, completed, cancelled, step_viewed) are not being tracked in PostHog, losing valuable user behavior insights.

## Proposed Solution

Inject the Analytics service and implement real event tracking in `#trackEvent()`. Map tutorial event actions to PostHog event names and include relevant context (tourId, step info).

## Dependencies

- Task #1: Logger integration (to use Logger for error handling in catch block)

## Context

- Analytics service: `core/analytics/analytics.ts`
- Target method: `#trackEvent()` in `tutorial.service.ts:350-358`
- Event mapping:
  - `'started'` → `'tutorial_started'`
  - `'completed'` → `'tutorial_completed'`
  - `'cancelled'` → `'tutorial_cancelled'`
  - `'step_viewed'` → `'tutorial_step_viewed'`
- Injection pattern: `readonly #analytics = inject(Analytics);`
- Method: `this.#analytics.captureEvent(eventName, properties)`

**Current placeholder code:**
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

## Success Criteria

- Analytics service injected in TutorialService
- `#trackEvent()` calls `analytics.captureEvent()` with mapped event name
- TODO comment removed
- Error handling uses Logger (from Task 1)
- Events visible in PostHog dashboard when completing a tour
