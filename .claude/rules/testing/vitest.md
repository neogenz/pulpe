---
description: Testing patterns with Vitest and Angular TestBed
paths:
  - "**/*.spec.ts"
  - "**/e2e/**/*.ts"
---

# Testing with Vitest

## Framework
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
```

## Core Principles

- **AAA Pattern:** Arrange, Act, Assert (separate with blank lines)
- **Descriptive Names:** `should + expected behavior`
- **Use Existing Types:** Leverage project types for test data
- **English Only:** All test code and descriptions

## Component Testing

```typescript
describe('GreetingComponent', () => {
  let fixture: ComponentFixture<GreetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GreetingComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GreetingComponent);
  });

  it('should render greeting', () => {
    fixture.componentRef.setInput('name', 'World');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('World');
  });
});
```

## Service Testing

```typescript
describe('CounterService', () => {
  let service: CounterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CounterService);
  });

  it('should start at 0', () => {
    expect(service.count()).toBe(0);
  });
});
```

## Mocking

```typescript
const mockService: Partial<LoggingService> = {
  error: vi.fn(),
};

TestBed.configureTestingModule({
  providers: [{ provide: LoggingService, useValue: mockService }],
});
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Test implementation details | Test behavior and outcomes |
| Share mutable state | Reset in `beforeEach` |
| Use `any` in tests | Use proper types |
| Skip AAA structure | Separate Arrange, Act, Assert |
