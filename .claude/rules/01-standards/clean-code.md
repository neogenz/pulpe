---
description: Code quality standards and length limits
paths: "**/*.ts"
---

# Clean Code

## Code Quality

- Write self-documenting code, no comments needed
- Use strict types only, no `any`
- Use explicit constants, never magic numbers
- Avoid double negatives (`!isInvalid` → `isValid`)
- Write the simplest code possible
- Eliminate duplication (DRY) — but DRY applies to **logic**, not trivial expressions. A one-liner ternary repeated in 4 files does NOT warrant a shared utility. Three similar lines are better than a premature abstraction. Only extract when the duplicated code contains **branching, computation, or is likely to diverge**.

```typescript
// Good
const MAX_RETRY_COUNT = 3;
if (retryCount >= MAX_RETRY_COUNT) { /* ... */ }

// Bad
if (retryCount >= 3) { /* ... */ }
```

## Length Limits

| Element | Max |
|---------|-----|
| Function lines | 30 |
| Function parameters | 5 |
| File lines | 300 |
| Files per folder | 10 |

## Single Responsibility

One responsibility per file. Split when a file does multiple things.

## Functions

No flag parameters. Split into separate functions instead:

```typescript
// Good
saveAsDraft()
saveAndPublish()

// Bad
save(isDraft: boolean)
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `if (retryCount >= 3)` | `if (retryCount >= MAX_RETRY_COUNT)` |
| `!isInvalid` | `isValid` |
| `save(isDraft: boolean)` | `saveAsDraft()` / `saveAndPublish()` |
| Comments explaining code | Self-documenting code |