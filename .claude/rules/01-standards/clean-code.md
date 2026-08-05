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

| Element | `backend-nest/src/**` | `frontend/`, `landing/`, `shared/` |
|---------|-----|-----|
| Function lines | 50 (warn) | not enforced |
| Function parameters | 7 (warn) | not enforced |
| File lines | not enforced | not enforced |
| Files per folder | not enforced | not enforced |

Only `backend-nest/eslint.config.js` enforces any of these, and its own `*.spec.ts` / `*.test.ts` / `src/test/**` override turns them off. "Files per folder" is enforced by no tool anywhere — treat it as a habit, not a gate.

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