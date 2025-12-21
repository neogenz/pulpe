---
description: TypeScript conventions and type safety patterns
globs:
  - "**/*.ts"
  - "!**/*.spec.ts"
---

# TypeScript

## Strict Types

- Type explicitly when inference is not obvious
- NEVER use `any`, prefer `unknown`
- Prefer type guards over `as` assertions

```typescript
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value;
}
```

## Interfaces vs Types

- `interface` for object shapes
- `type` for unions and primitives

```typescript
interface User { id: string; name: string; }
type Status = 'pending' | 'active' | 'archived';
```

## Nullability

Prefer optional fields over union with `undefined`:
```typescript
interface Config { timeout?: number; }  // Good
```

## Enumerations

Prefer string literal unions over enums:
```typescript
type OrderStatus = 'pending' | 'confirmed' | 'shipped';
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `const data: any` | `const data: unknown` |
| `timeout: number \| undefined` | `timeout?: number` |
| `const enum Status {}` | `type Status = 'a' \| 'b'` |
