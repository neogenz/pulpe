# Implementation Plan: Add ProductTourService Unit Tests

## Overview

Add unit tests for `ProductTourService` to cover localStorage-based tour tracking functionality. Tests focus on the public API methods that manage tour completion state, following YAGNI principles by not testing third-party library interactions (Driver.js).

## Dependencies

- None - Service is standalone with `providedIn: 'root'`
- Uses jsdom environment (already configured in Vitest)

## File Changes

### `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.spec.ts` (NEW)

- **Create** new test file following project conventions
- **Import** Vitest test utilities (`describe`, `it`, `expect`, `beforeEach`, `afterEach`)
- **Import** Angular testing (`TestBed`, `provideZonelessChangeDetection`)
- **Import** Service and constants (`ProductTourService`, `TOUR_STORAGE_KEYS`, `TourPageId`)

#### Test Setup
- Clear localStorage in `beforeEach` and `afterEach` (follow pattern from `demo-mode.service.spec.ts`)
- Configure TestBed with `provideZonelessChangeDetection()` for Angular 20+
- Inject service via `TestBed.inject()`

#### Test Cases: `hasSeenIntro()`
- Test: Returns `false` when localStorage has no intro key
- Test: Returns `true` when localStorage has `'true'` value
- Test: Returns `false` for non-`'true'` values (e.g., `'false'`)

#### Test Cases: `hasSeenPageTour(pageId)`
- Test: Returns `false` for each page ID when not seen
- Test: Returns `true` for each page ID when marked as seen
- Cover all 4 page IDs: `'current-month'`, `'budget-list'`, `'budget-details'`, `'templates-list'`

#### Test Cases: `resetAllTours()`
- Test: Clears all tour keys from localStorage
- Test: Clears legacy key `'pulpe_tour_completed'`
- Test: Handles being called when no tours have been seen (no error)

#### Test Cases: `TOUR_STORAGE_KEYS` constant
- Test: Validates correct key format for intro
- Test: Validates correct key format for all page tour keys

## Testing Strategy

### Tests Created
- `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.spec.ts`
  - 16 test cases total

### Test Coverage
| Method | Tests | Coverage |
|--------|-------|----------|
| `hasSeenIntro()` | 3 | Full |
| `hasSeenPageTour()` | 8 | All page IDs |
| `resetAllTours()` | 3 | Full |
| `TOUR_STORAGE_KEYS` | 2 | Key validation |

### Not Tested (Intentional)
- `startPageTour()` - Depends on Driver.js third-party library
- Step definitions - Static readonly data, no logic to test

### Verification Commands
```bash
# Run specific test file
cd frontend && pnpm test -- projects/webapp/src/app/core/product-tour/product-tour.service.spec.ts

# Run all tests
pnpm test

# Run quality checks
pnpm quality
```

## Documentation

- No documentation updates needed
- Test file is self-documenting with clear test case names

## Rollout Considerations

- No breaking changes
- Tests are additive only
- No migration needed

## Status: COMPLETED ✅

Implementation was completed with:
- 16 tests passing
- Quality checks passing (0 errors)
- Following established patterns from `demo-mode.service.spec.ts`
