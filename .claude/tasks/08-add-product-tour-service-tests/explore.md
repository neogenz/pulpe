# Task: Add ProductTourService Unit Tests

## Codebase Context

### Testing Framework
- **Vitest** with jsdom environment
- Angular TestBed with `provideZonelessChangeDetection()`
- Test setup in `frontend/projects/webapp/src/test-setup.ts`

### Existing Test Patterns
Found excellent example in `demo-mode.service.spec.ts` that:
- Uses `localStorage.clear()` in `beforeEach` and `afterEach`
- Tests localStorage persistence
- Tests state restoration across sessions
- Handles localStorage errors gracefully

### Key File
- `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.ts`

## Test Strategy

### Methods to Test
1. `hasSeenIntro()` - Returns boolean from localStorage
2. `hasSeenPageTour(pageId)` - Returns boolean for specific page
3. `resetAllTours()` - Clears all tour keys from localStorage

### Skip Testing
- `startPageTour()` - Depends on Driver.js (third-party library)
- Step definitions - Static data, no logic

## Patterns to Follow

From `demo-mode.service.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

describe('ServiceName', () => {
  let service: ServiceType;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ServiceType,
      ],
    });
    service = TestBed.inject(ServiceType);
  });

  afterEach(() => {
    localStorage.clear();
  });
});
```

## Dependencies
- No external dependencies needed
- Service is standalone with `providedIn: 'root'`
