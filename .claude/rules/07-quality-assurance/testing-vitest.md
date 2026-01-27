---
description: "Vitest testing patterns with Angular TestBed"
paths:
  - "**/*.spec.ts"
  - "**/e2e/**/*.ts"
---

# Testing

Path pattern: `**/*.spec.ts`

## Framework

This project uses **Vitest** with Angular TestBed integration.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
```

## Organization

### File Placement

Place test files next to the code they test:

```
feature/
├── user.service.ts
├── user.service.spec.ts
├── user-list.ts
└── user-list.spec.ts
```

### Describe Blocks

Structure tests with nested `describe` blocks:

```typescript
describe('UserService', () => {
  // Setup

  describe('fetchUsers', () => {
    it('should return users on success', () => {});
    it('should throw OperationalError on network failure', () => {});
  });

  describe('deleteUser', () => {
    it('should remove user from list', () => {});
  });
});
```

## Core Principles

### Language

Write all test code and descriptions in **English**.

### Arrange-Act-Assert (AAA)

Separate each test into three distinct phases with blank lines:

```typescript
it('should increment the count', () => {
  // Arrange
  const service = TestBed.inject(CounterService);

  // Act
  service.increment();

  // Assert
  expect(service.count()).toBe(1);
});
```

### Descriptive Names

Use `should + expected behavior` format:

```typescript
// Good
it('should return empty array when no users exist', () => {});
it('should throw BusinessError when user lacks permission', () => {});

// Bad
it('works', () => {});
it('test user', () => {});
```

### Use Existing Types

Leverage project types for test data:

```typescript
// Good - uses existing User type
const user: User = { id: '1', name: 'John', role: 'admin' };

// Bad - inline object without type
const user = { id: '1', name: 'John', role: 'admin' };
```

## Component Testing

### Setup Pattern

```typescript
describe('GreetingComponent', () => {
  let component: GreetingComponent;
  let fixture: ComponentFixture<GreetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GreetingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GreetingComponent);
    component = fixture.componentInstance;
  });
});
```

### Setting Inputs

Use `setInput` for signal inputs:

```typescript
beforeEach(() => {
  fixture.componentRef.setInput('name', 'World');
  fixture.detectChanges();
});
```

### Testing Outputs

```typescript
it('should emit event on button click', () => {
  const spy = vi.fn();
  component.clicked.subscribe(spy);

  const button = fixture.nativeElement.querySelector('button');
  button.click();

  expect(spy).toHaveBeenCalledOnce();
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

### Dependencies

```typescript
beforeEach(() => {
  const mockLoggingService: Partial<LoggingService> = {
    error: vi.fn(),
    addBreadcrumb: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [{ provide: LoggingService, useValue: mockLoggingService }],
  });
});
```

### Factory Functions

Create reusable test data factories:

```typescript
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  ...overrides,
});

const createHttpError = (status: number, statusText = 'Error'): HttpErrorResponse => {
  return new HttpErrorResponse({ status, statusText, url: '/api/test' });
};
```

## Async Testing

### With async/await

```typescript
it('should fetch users', async () => {
  const users = await service.fetchUsers();

  expect(users).toHaveLength(3);
});
```

### With Injection Context

```typescript
const runInterceptor = (request: HttpRequest<unknown>): Promise<Error> => {
  return new Promise((resolve) => {
    TestBed.runInInjectionContext(() => {
      interceptor(request, next).subscribe({
        error: (err) => resolve(err),
      });
    });
  });
};
```

## User Interaction Tests

Prefer testing through user interactions:

```typescript
// Good - simulates user action
it('should submit form on button click', () => {
  const button = fixture.nativeElement.querySelector('button[type="submit"]');
  button.click();

  expect(component.submitted()).toBe(true);
});

// Acceptable - direct method call when UI not relevant
it('should validate email format', () => {
  const result = service.validateEmail('invalid');

  expect(result.valid).toBe(false);
});
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Test implementation details | Test behavior and outcomes |
| Share mutable state between tests | Reset state in `beforeEach` |
| Use magic strings/numbers | Use constants or factory functions |
| Write comments in tests | Make test names self-explanatory |
| Combine multiple assertions without reason | One logical assertion per test |
| Skip AAA structure | Always separate Arrange, Act, Assert |
| Use `any` in test code | Use proper types |
