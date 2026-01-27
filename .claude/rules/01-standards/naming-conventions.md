---
description: Naming conventions for variables, functions, and constants
paths: "**/*.ts"
---

# Naming Conventions

## General Principles

- Use descriptive names that reveal intent
- No single-letter names except loop indices (`i`, `j`, `k`)
- No abbreviations except common ones (`id`, `url`, `http`, `api`)
- Use consistent terminology across the codebase

## Functions and Methods

Use verbs for actions, nouns for value-returning:

```typescript
// Good - action verbs
fetchUsers()
calculateTotal()
validateForm()
submitOrder()

// Good - noun for value-returning
userName()
totalPrice()
formErrors()

// Bad - unclear intent
doStuff()
process()
handle()
```

### Boolean Functions

Prefix with `is`, `has`, `should`, `can`:

```typescript
// Good
isValid()
hasPermission()
shouldRetry()
canEdit()

// Bad
valid()
permission()
retry()
edit()
```

## Variables and Properties

### Collections

Use plural for arrays and collections:

```typescript
// Good
readonly #users = signal<User[]>([]);
readonly items: Item[];
readonly selectedIds = new Set<string>();

// Bad
readonly #user = signal<User[]>([]);
readonly item: Item[];
readonly selectedId = new Set<string>();
```

### Booleans

Prefix with `is`, `has`, `should`, `can`:

```typescript
// Good
readonly isLoading = signal(false);
readonly hasError = computed(() => !!this.#error());
readonly shouldShowModal = signal(false);

// Bad
readonly loading = signal(false);
readonly error = computed(() => !!this.#error());
readonly showModal = signal(false);
```

## Constants

Use `UPPER_SNAKE_CASE` for constants:

```typescript
// Good
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = '/api/v1';
const DEFAULT_PAGE_SIZE = 20;

// Bad
const maxRetryCount = 3;
const apiBaseUrl = '/api/v1';
```

### Grouping Constants

Group related constants in object or enum:

```typescript
// Good - grouped in object
export const HttpStatus = {
  OK: 200,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;

// Good - enum for variants
export enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Shipped = 'shipped',
}

// Bad - scattered constants
export const HTTP_OK = 200;
export const HTTP_NOT_FOUND = 404;
export const HTTP_SERVER_ERROR = 500;
```

## Summary

| Element | Convention | Example |
|---------|------------|---------|
| Functions (actions) | `verbNoun` | `fetchUsers()` |
| Functions (getters) | `noun` | `userName()` |
| Boolean functions | `is/has/should/canNoun` | `isValid()` |
| Boolean variables | `is/has/should/canNoun` | `isLoading` |
| Collections | plural | `users`, `items` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Related constants | grouped object/enum | `HttpStatus.OK` |

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `x`, `temp`, `data` | Descriptive name revealing intent |
| `usr`, `mgr`, `btn` | `user`, `manager`, `button` |
| `doSomething()` | `calculateTotal()`, `fetchUsers()` |
| `item: Item[]` | `items: Item[]` |
| `loading = signal(false)` | `isLoading = signal(false)` |
| Scattered related constants | Group in object or enum |