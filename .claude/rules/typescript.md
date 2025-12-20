# TypeScript

## Strict Types

- Type explicitly when inference is not obvious
- Never use `any`, prefer `unknown` when type is uncertain
- Prefer type guards over `as` assertions

```typescript
// Good - type guard
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value;
}

if (isUser(data)) {
  console.log(data.id); // typed as User
}

// Acceptable - as syntax when necessary
const element = event.target as HTMLInputElement;
```

## Interfaces vs Types

Use `interface` for object shapes, `type` for unions and primitives:

```typescript
// Good - interface for objects
interface User {
  id: string;
  name: string;
}

// Good - type for unions
type Status = 'pending' | 'active' | 'archived';
type Id = string | number;
```

## Nullability

Prefer optional fields over union with `undefined`:

```typescript
// Good
interface Config {
  timeout?: number;
}

// Avoid
interface Config {
  timeout: number | undefined;
}
```

## Enumerations

Prefer string literal unions. If enum needed, use plain enum (not `const enum`):

```typescript
// Preferred - string literal union
type OrderStatus = 'pending' | 'confirmed' | 'shipped';

// Acceptable - plain enum with explicit values
enum HttpStatus {
  OK = 200,
  NotFound = 404,
}
```

## Generics

Use descriptive names for complex generics, single letter for simple cases:

```typescript
// Good - simple generic
function identity<T>(value: T): T { return value; }

// Good - descriptive for complex
function map<TInput, TOutput>(items: TInput[], fn: (item: TInput) => TOutput): TOutput[]
```

## Summary

| Element | Convention |
|---------|------------|
| Uncertain types | `unknown` over `any` |
| Type narrowing | Type guards over `as` assertions |
| Object shapes | `interface` |
| Unions/primitives | `type` |
| Optional fields | `timeout?: number` |
| Enumerations | String literal unions preferred |
| Simple generics | Single letter (`T`) |
| Complex generics | Descriptive names (`TInput`, `TOutput`) |

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `const data: any = response` | `const data: unknown = response` |
| `timeout: number \| undefined` | `timeout?: number` |
| `const enum Status {}` | `type Status = 'a' \| 'b'` |
| `function fetch<T>(): Promise<User>` (unused T) | Remove unused type parameters |

## Related

- Error handling patterns: see `error-handling.md`

## Sources

- [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
