# Task: Update TutorialService Tests for Logger and Analytics

## Problem

After integrating Logger and Analytics into TutorialService, the existing tests will fail due to missing dependency mocks. Additionally, there's no test coverage for the analytics tracking functionality.

## Proposed Solution

Update the test setup to provide mock Logger and Analytics services. Add a test case to verify analytics events are captured when a tour completes.

## Dependencies

- Task #1: Logger integration (tests need to mock Logger)
- Task #2: Analytics integration (tests need to mock and verify Analytics)

## Context

- Test file: `core/tutorial/tutorial.service.spec.ts`
- Test setup uses `createService()` helper with TestBed
- Existing tests focus on tour lifecycle, not logging/analytics

**Mock structures:**
```typescript
Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
Analytics: { captureEvent: vi.fn() }
```

**New test case:** Verify `analytics.captureEvent` is called with `'tutorial_completed'` when a tour completes.

## Success Criteria

- Logger mock added to TestBed providers
- Analytics mock added to TestBed providers
- All existing tests pass
- New test verifies `captureEvent('tutorial_completed', ...)` called on tour completion
- `pnpm test -- --filter tutorial.service` passes
